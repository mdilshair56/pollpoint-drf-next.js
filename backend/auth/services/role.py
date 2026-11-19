from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from common.exceptions import APIValidationError

User = get_user_model()


def is_superadmin(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def is_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_superuser
            or user.role in (User.Role.ADMIN, User.Role.SUPERADMIN)
        )
    )


class RoleService:
    @staticmethod
    @transaction.atomic
    def promote(*, actor, target_id, role):
        if not is_admin(actor):
            raise PermissionDenied("Only an administrator can change account roles.")

        allowed_roles = (User.Role.CLIENT, User.Role.ADMIN, User.Role.SUPERADMIN)
        if role not in allowed_roles:
            raise APIValidationError({"role": "Choose client, admin, or superadmin."})

        if role == User.Role.SUPERADMIN and not is_superadmin(actor):
            raise PermissionDenied("Only a superadmin can grant superadmin access.")

        target = User.objects.select_for_update().filter(pk=target_id).first()
        if target is None:
            raise APIValidationError({"user_id": "User not found."})

        if target.pk == actor.pk and role != User.Role.SUPERADMIN:
            raise APIValidationError({"role": "You cannot remove your own superadmin privileges."})

        if not is_superadmin(actor) and (
            target.is_superuser
            or target.role in (User.Role.ADMIN, User.Role.SUPERADMIN)
        ):
            raise PermissionDenied("Only a superadmin can change the role of an administrator.")

        if (
            target.is_superuser
            and role != User.Role.SUPERADMIN
            and User.objects.filter(is_superuser=True, is_active=True).count() <= 1
        ):
            raise APIValidationError({"role": "The last active superadmin cannot be demoted."})

        target.role = role
        target.is_superuser = role == User.Role.SUPERADMIN
        target.is_staff = role == User.Role.SUPERADMIN
        target.save(update_fields=["role", "is_superuser", "is_staff"])
        return target
