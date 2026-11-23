import hashlib
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction

from common.exceptions import APIValidationError
from auth.tasks import send_email_change_otp_task

User = get_user_model()


class EmailChangeService:
    PURPOSE = "email_change"

    @classmethod
    def _challenge_key(cls, user_id):
        return f"email_change_otp:{user_id}"

    @classmethod
    def _attempts_key(cls, user_id):
        return f"email_change_attempts:{user_id}"

    @classmethod
    def _lock_key(cls, user_id):
        return f"email_change_verify_lock:{user_id}"

    @classmethod
    def validate_new_email(cls, *, user=None, new_email):
        new_email = new_email.strip().lower()

        # 1. Reject if identical to current email
        if user and user.email and user.email.strip().lower() == new_email:
            raise APIValidationError({
                "email": "This is already your current email address."
            })

        # 2. Reject if registered to any other active user
        query = User.objects.filter(email__iexact=new_email)
        if user and getattr(user, "pk", None):
            query = query.exclude(pk=user.pk)
        if query.exists():
            raise APIValidationError({
                "email": "An account with this email already exists."
            })

        return new_email

    @classmethod
    def request_email_change(cls, *, user, new_email):
        clean_email = cls.validate_new_email(user=user, new_email=new_email)

        # Generate cryptographically secure 6-digit OTP
        otp = f"{secrets.randbelow(1_000_000):06d}"
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()

        challenge_payload = {
            "otp_hash": otp_hash,
            "pending_email": clean_email,
            "user_id": user.pk,
            "purpose": cls.PURPOSE,
        }

        ttl = getattr(settings, "LOGIN_OTP_TTL_SECONDS", 180)
        cache.set(cls._challenge_key(user.pk), challenge_payload, timeout=ttl)
        cache.delete(cls._attempts_key(user.pk))

        # Send OTP to the NEW email address to verify ownership
        send_email_change_otp_task.delay(clean_email, otp)

    @classmethod
    def verify_email_change(cls, *, user, submitted_otp):
        key = cls._challenge_key(user.pk)
        attempts_key = cls._attempts_key(user.pk)
        lock_key = cls._lock_key(user.pk)
        ttl = getattr(settings, "LOGIN_OTP_TTL_SECONDS", 180)
        max_attempts = getattr(settings, "LOGIN_OTP_MAX_ATTEMPTS", 5)

        # Concurrency lock prevents replay race conditions
        if not cache.add(lock_key, secrets.token_urlsafe(16), timeout=10):
            raise APIValidationError({
                "detail": "Verification is already in progress. Try again."
            })

        try:
            challenge = cache.get(key)
            if not challenge or challenge.get("purpose") != cls.PURPOSE:
                raise APIValidationError({
                    "detail": "Invalid or expired verification code."
                })

            if challenge.get("user_id") != user.pk:
                raise APIValidationError({
                    "detail": "Invalid challenge owner."
                })

            # Track attempts
            cache.add(attempts_key, 0, timeout=ttl)
            try:
                attempts = cache.incr(attempts_key)
            except ValueError:
                cache.add(attempts_key, 1, timeout=ttl)
                attempts = 1

            if attempts > max_attempts:
                cache.delete(key)
                cache.delete(attempts_key)
                raise APIValidationError({
                    "detail": "Too many invalid attempts. Please request a new verification code."
                })

            # Constant-time comparison
            submitted_hash = hashlib.sha256(submitted_otp.encode()).hexdigest()
            if not secrets.compare_digest(submitted_hash, challenge["otp_hash"]):
                raise APIValidationError({
                    "detail": "Invalid or expired verification code."
                })

            pending_email = challenge["pending_email"]

            # Atomic database update with row-level lock
            with transaction.atomic():
                user_record = User.objects.select_for_update().get(pk=user.pk)

                # Re-check uniqueness in case another user registered the email in the meantime
                if User.objects.filter(email__iexact=pending_email).exclude(pk=user_record.pk).exists():
                    cache.delete(key)
                    cache.delete(attempts_key)
                    raise APIValidationError({
                        "email": "This email address is no longer available."
                    })

                user_record.email = pending_email
                user_record.save(update_fields=["email"])

            # Delete cache challenge on successful consumption
            cache.delete(key)
            cache.delete(attempts_key)

            return user_record
        finally:
            cache.delete(lock_key)
