import hashlib
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken

from common.exceptions import APIValidationError
from auth.tasks import send_login_otp_email_task


User = get_user_model()


class LoginOTPService:
    @staticmethod
    def _get_unique_active_user(*, email):
        matching_users = list(
            User.objects.filter(
                email__iexact=email,
                is_active=True,
            )[:2]
        )
        if len(matching_users) != 1:
            return None
        return matching_users[0]

    @classmethod
    def request_login_code(cls, *, email):
        user = cls._get_unique_active_user(email=email)
        if user is not None:
            cls.create_challenge(user)

    @staticmethod
    def create_challenge(user):
        otp = f"{secrets.randbelow(1_000_000):06d}"
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()

        cache.set(
            f"login_otp:{user.pk}",
            {"otp_hash": otp_hash},
            timeout=settings.LOGIN_OTP_TTL_SECONDS,
        )
        cache.delete(f"login_otp_attempts:{user.pk}")
        send_login_otp_email_task.delay(user.email, otp)

    @classmethod
    def verify_login_code(cls, *, email, submitted_otp):
        user = cls._get_unique_active_user(email=email)
        if user is None:
            raise APIValidationError({"detail": "Invalid or expired login code."})

        valid, message = cls.verify_challenge(
            user=user,
            submitted_otp=submitted_otp,
        )
        if not valid:
            raise APIValidationError({"detail": message})

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

    @staticmethod
    def verify_challenge(user, submitted_otp):
        key = f"login_otp:{user.pk}"
        attempts_key = f"login_otp_attempts:{user.pk}"
        lock_key = f"login_otp_verify_lock:{user.pk}"

        # The short lock prevents simultaneous successful submissions from
        # reusing the same OTP.
        if not cache.add(lock_key, secrets.token_urlsafe(16), timeout=10):
            return False, "Verification is already in progress. Try again."

        try:
            challenge = cache.get(key)
            if challenge is None:
                return False, "Invalid or expired login code."

            cache.add(attempts_key, 0, timeout=settings.LOGIN_OTP_TTL_SECONDS)
            try:
                attempts = cache.incr(attempts_key)
            except ValueError:
                cache.add(attempts_key, 1, timeout=settings.LOGIN_OTP_TTL_SECONDS)
                attempts = 1

            if attempts > settings.LOGIN_OTP_MAX_ATTEMPTS:
                cache.delete(key)
                return False, "Invalid or expired login code."

            submitted_hash = hashlib.sha256(submitted_otp.encode()).hexdigest()
            if not secrets.compare_digest(submitted_hash, challenge["otp_hash"]):
                return False, "Invalid or expired login code."

            cache.delete(key)
            cache.delete(attempts_key)
            return True, "OTP verified successfully."
        finally:
            cache.delete(lock_key)
