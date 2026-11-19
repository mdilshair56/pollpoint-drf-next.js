from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from common.exceptions import APIValidationError
from  rest_framework.permissions import BasePermission, SAFE_METHODS

from auth.models.user import User
from auth.models.user_profile import UserProfile

from auth.tasks import send_password_reset_email_task



from django.conf import settings

UserModel = get_user_model()


class UserService:

    # 1. signup_serializer.py
    @staticmethod
    def validate_user_password(*, password, user=None):
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            raise APIValidationError(exc.messages)
        return password

    @staticmethod
    def validate_signup_email(*, email):
        email = email.strip()

        if User.objects.filter(email__iexact=email).exists():
            raise APIValidationError({
                "email": "An account with this email already exists."
            })

        return email

    # 2. signup_view.py
    @staticmethod
    @transaction.atomic
    def create_user(*, validated_data):
        validated_data = validated_data.copy()

        profile_data = validated_data.pop("profile", None)
        password = validated_data.pop("password")

        # Public registration must never grant staff or superuser privileges.
        validated_data.pop("role", None)
        validated_data["role"] = User.Role.CLIENT
        validated_data["is_superuser"] = False
        validated_data["is_staff"] = False

        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        if profile_data is not None:
            UserProfile.objects.create(
                user=user,
                **profile_data,
            )

        return user


    # 3. token_serializer.py
    @staticmethod
    def build_login_response(*, token_data, user_data):
        return {
            "success": True,
            "message": "Login successful.",
            "data": {
                "access": token_data["access"],
                "refresh": token_data["refresh"],
                "user": user_data,
            },
        }


    # 4. reset_password_serializer.py
    @staticmethod
    def validate_password_reset_data(*, attrs):
        email = (attrs.get("email") or "").strip()
        uid = (attrs.get("uid") or "").strip()
        token = (attrs.get("token") or "").strip()
        new_password = attrs.get("new_password") or ""
        confirm_password = attrs.get("confirm_password") or ""

        if not any([email, uid, token, new_password, confirm_password]):
            raise APIValidationError({
                "email": (
                    "Provide 'email' to receive a reset link, or provide "
                    "'uid', 'token', 'new_password', and 'confirm_password' to reset your password."
                )
            })

        # STEP 1: User submitted email to request the reset link in terminal/email
        if email and not any([uid, token, new_password, confirm_password]):
            # A generic response is returned regardless of whether one
            # unambiguous active account exists for the supplied address.
            matching_users = UserModel.objects.filter(
                email__iexact=email,
                is_active=True,
            )
            attrs["user"] = matching_users.first() if matching_users.count() == 1 else None
            attrs["step"] = "send_reset_link"
            return attrs

        # STEP 2: User submitted uid, token, new_password, confirm_password to set new password
        missing_fields = [
            field_name
            for field_name in ("uid", "token", "new_password", "confirm_password")
            if not (attrs.get(field_name) or "").strip()
        ]
        if missing_fields:
            raise APIValidationError({
                field: "This field is required when resetting your password."
                for field in missing_fields
            })

        if new_password != confirm_password:
            raise APIValidationError({
                "confirm_password": "Passwords do not match."
            })

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = UserModel.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, UserModel.DoesNotExist):
            raise APIValidationError({
                "token": "Invalid or expired reset link."
            })

        if not default_token_generator.check_token(user, token):
            raise APIValidationError({
                "token": "Invalid or expired reset link."
            })

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise APIValidationError({
                "new_password": exc.messages
            })

        attrs["user"] = user
        attrs["step"] = "confirm_new_password"
        return attrs


    # 5. UserService.execute_password_reset() (Step 1)
    @staticmethod
    def send_password_reset_email(*, user):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        reset_url = (
            f"{settings.PASSWORD_RESET_FRONTEND_URL}"
            f"?uid={uid}&token={token}"
        )

        send_password_reset_email_task.delay(
            user.email,
            reset_url,
        )
        return "Password reset email has been sent."

    # 6. UserService.execute_password_reset() (Step 2)
    @staticmethod
    @transaction.atomic
    def reset_user_password(*, user, new_password):
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Revoke every outstanding refresh token for this account.
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        return "Password reset successfully."


    # 7. reset_password_view.py
    @staticmethod
    def execute_password_reset(*, validated_data):
        user = validated_data["user"]
        if validated_data["step"] == "send_reset_link":
            if user is not None:
                UserService.send_password_reset_email(user=user)
            return "If an account exists for that email, a password reset link has been sent."

        return UserService.reset_user_password(
            user=user,
            new_password=validated_data["new_password"],
        )

    # 8. profile_view.py
    @staticmethod
    def get_or_create_user_profile(*, user):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile

 # Admin and Client
class IsAdminRole(BasePermission):
    """Allow administrative user/profile directory access only."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.role in (User.Role.ADMIN, User.Role.SUPERADMIN)
            )
        )


class IsAdminOrReadOnlyClient(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or request.user.role in (User.Role.ADMIN, User.Role.SUPERADMIN):
            return True
        return request.method in SAFE_METHODS
