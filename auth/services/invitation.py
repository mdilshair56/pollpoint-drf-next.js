import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from common.exceptions import APIValidationError, ConflictError
from auth.models.invitation import AdminInvitation
from auth.tasks import send_admin_invitation_email_task

User = get_user_model()


def _is_superadmin(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def _is_admin(user):
    return bool(
        user and user.is_authenticated
        and (user.is_superuser or user.role in (User.Role.ADMIN, User.Role.SUPERADMIN))
    )


# class InvitationService:
#     TTL = timedelta(hours=24)

class InvitationService:
    TTL = timedelta(hours=24)

    @staticmethod
    def _expire_pending_invitations(*, queryset):
        now = timezone.now()

        return queryset.filter(
            status=AdminInvitation.Status.PENDING,
            expires_at__lte=now,
        ).update(
            status=AdminInvitation.Status.EXPIRED,
            updated_at=now,
        )

    @staticmethod
    def refresh_expired_status(*, invitation):
        InvitationService._expire_pending_invitations(
            queryset=AdminInvitation.objects.filter(pk=invitation.pk)
        )

        invitation.refresh_from_db(
            fields=["status", "updated_at"]
        )

        return invitation.status

    @staticmethod
    @transaction.atomic
    def create(*, email, invited_by):
        if not (invited_by and invited_by.is_authenticated):
            raise PermissionDenied("Sign in to invite users.")
        email = email.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise APIValidationError({"email": "An account with this email already exists. Use role promotion instead."})

        AdminInvitation.objects.select_for_update().filter(
            email__iexact=email,
            status=AdminInvitation.Status.PENDING,
        ).update(status=AdminInvitation.Status.EXPIRED, updated_at=timezone.now())

        raw_token = secrets.token_urlsafe(48)
        invitation = AdminInvitation.objects.create(
            email=email,
            token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            invited_by=invited_by,
            expires_at=timezone.now() + InvitationService.TTL,
        )
        accept_url = f"{settings.INVITATION_FRONTEND_URL}?token={raw_token}"
        transaction.on_commit(
            lambda: send_admin_invitation_email_task.delay(
                email,
                accept_url,
                invited_by.get_full_name() or invited_by.username,
                invitation.expires_at.isoformat(),
            )
        )
        return invitation

    @staticmethod
    def get_from_token(raw_token, *, lock=False):
        if not raw_token:
            raise APIValidationError({"token": "Invitation token is required."})
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        queryset = AdminInvitation.objects.select_related("invited_by")
        if lock:
            queryset = queryset.select_for_update()
        invitation = queryset.filter(token_hash=token_hash).first()
        if invitation is None:
            raise APIValidationError({"token": "Invalid invitation link."})
        InvitationService.refresh_expired_status(invitation=invitation)
        if invitation.status != AdminInvitation.Status.PENDING:
            raise ConflictError(f"This invitation is {invitation.status}.")
        return invitation

    @staticmethod
    @transaction.atomic
    def respond(*, raw_token, decision, user=None):
        invitation = InvitationService.get_from_token(raw_token, lock=True)
        if decision == "decline":
            invitation.status = AdminInvitation.Status.DECLINED
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=["status", "responded_at", "updated_at"])
            return invitation

        if decision != "accept":
            raise APIValidationError({"decision": "Choose accept or decline."})

        if user is None:
            raise APIValidationError({"detail": "Register or sign in with the invited email address before accepting."})
        if user.email.casefold() != invitation.email.casefold():
            raise PermissionDenied("Sign in with the email address that received this invitation.")

        invitation.status = AdminInvitation.Status.ACCEPTED
        invitation.responded_at = timezone.now()
        invitation.accepted_by = user
        invitation.save(update_fields=["status", "responded_at", "accepted_by", "updated_at"])
        return invitation

    @staticmethod
    def list_for_admin(user):
        if not (user and user.is_authenticated):
            raise PermissionDenied("Sign in to view invitations.")
        queryset = AdminInvitation.objects.select_related("invited_by", "accepted_by")
        if not user.is_superuser:
            queryset = queryset.filter(invited_by=user)
        now = timezone.now()
        queryset.filter(status=AdminInvitation.Status.PENDING, expires_at__lte=now).update(
            status=AdminInvitation.Status.EXPIRED,
            updated_at=now,
        )
        return queryset
