import hashlib
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient, APIRequestFactory

from common.exceptions import APIValidationError
from auth.services.login_otp import LoginOTPService
from auth.views.login_otp_view import LoginOTPRequestView, LoginOTPVerifyView


User = get_user_model()


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "login-otp-tests",
        }
    }
)
class LoginOTPServiceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="otp-user",
            email="otp@example.com",
            password="test-password",
        )

    def tearDown(self):
        cache.clear()

    @patch.object(LoginOTPService, "create_challenge")
    def test_request_only_creates_challenge_for_one_active_match(self, create_challenge):
        LoginOTPService.request_login_code(email="OTP@example.com")
        create_challenge.assert_called_once_with(self.user)

        User.objects.create_user(
            username="duplicate-otp-user",
            email="otp@example.com",
            password="test-password",
        )
        create_challenge.reset_mock()

        LoginOTPService.request_login_code(email="otp@example.com")
        create_challenge.assert_not_called()

    @patch("auth.services.login_otp.send_login_otp_email_task.delay")
    def test_create_challenge_stores_hash_and_sends_plain_code(self, send_email):
        LoginOTPService.create_challenge(self.user)

        cached_challenge = cache.get(f"login_otp:{self.user.pk}")
        self.assertIsNotNone(cached_challenge)
        send_email.assert_called_once()
        email, otp = send_email.call_args.args
        self.assertEqual(email, self.user.email)
        self.assertRegex(otp, r"^\d{6}$")
        self.assertEqual(
            cached_challenge["otp_hash"],
            hashlib.sha256(otp.encode()).hexdigest(),
        )

    @patch("auth.services.login_otp.RefreshToken.for_user")
    def test_valid_code_is_consumed_before_jwt_tokens_are_returned(self, for_user):
        cache.set(
            f"login_otp:{self.user.pk}",
            {"otp_hash": hashlib.sha256(b"123456").hexdigest()},
        )
        refresh = Mock()
        refresh.__str__ = Mock(return_value="refresh-token")
        refresh.access_token = "access-token"
        for_user.return_value = refresh

        tokens = LoginOTPService.verify_login_code(
            email=self.user.email,
            submitted_otp="123456",
        )

        self.assertEqual(tokens, {
            "refresh": "refresh-token",
            "access": "access-token",
        })
        self.assertIsNone(cache.get(f"login_otp:{self.user.pk}"))
        for_user.assert_called_once_with(self.user)

    def test_invalid_or_ambiguous_account_cannot_receive_tokens(self):
        with self.assertRaises(APIValidationError):
            LoginOTPService.verify_login_code(
                email="missing@example.com",
                submitted_otp="123456",
            )

        User.objects.create_user(
            username="duplicate-otp-user",
            email=self.user.email,
            password="test-password",
        )
        with self.assertRaises(APIValidationError):
            LoginOTPService.verify_login_code(
                email=self.user.email,
                submitted_otp="123456",
            )

    def test_invalid_code_does_not_issue_jwt(self):
        cache.set(
            f"login_otp:{self.user.pk}",
            {"otp_hash": hashlib.sha256(b"123456").hexdigest()},
        )

        with patch("auth.services.login_otp.RefreshToken.for_user") as for_user:
            with self.assertRaises(APIValidationError):
                LoginOTPService.verify_login_code(
                    email=self.user.email,
                    submitted_otp="654321",
                )

        for_user.assert_not_called()

    @patch.object(LoginOTPService, "request_login_code")
    def test_request_view_delegates_to_service_and_keeps_generic_response(self, request_code):
        request = APIRequestFactory().post(
            "/login/request-otp/",
            {"email": self.user.email},
            format="json",
        )

        response = LoginOTPRequestView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "If an account exists for that email, a login code has been sent.",
        )
        request_code.assert_called_once_with(email=self.user.email)

    @patch.object(LoginOTPService, "verify_login_code")
    def test_verify_view_returns_service_tokens(self, verify_code):
        verify_code.return_value = {
            "refresh": "refresh-token",
            "access": "access-token",
        }
        request = APIRequestFactory().post(
            "/login/verify-otp/",
            {"email": self.user.email, "otp": "123456"},
            format="json",
        )

        response = LoginOTPVerifyView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["refresh"], "refresh-token")
        self.assertEqual(response.data["access"], "access-token")
        verify_code.assert_called_once_with(
            email=self.user.email,
            submitted_otp="123456",
        )


class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="reset-user",
            email="reset@example.com",
            password="OriginalPassword123!",
        )

    @patch("auth.services.user.send_password_reset_email_task.delay")
    def test_request_password_reset_valid_user_queues_email(self, send_task):
        response = self.client.post(
            "/api/auth/reset-password/",
            {"email": "reset@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertIn("If an account exists", response.data["message"])
        send_task.assert_called_once()
        email_arg, reset_url = send_task.call_args.args
        self.assertEqual(email_arg, "reset@example.com")
        self.assertIn("?uid=", reset_url)
        self.assertIn("&token=", reset_url)

    @patch("auth.services.user.send_password_reset_email_task.delay")
    def test_request_password_reset_nonexistent_email_does_not_queue_email(self, send_task):
        response = self.client.post(
            "/api/auth/reset-password/",
            {"email": "nonexistent@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertIn("If an account exists", response.data["message"])
        send_task.assert_not_called()

    def test_confirm_password_reset_success(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/auth/reset-password/",
            {
                "uid": uid,
                "token": token,
                "new_password": "NewSecretPassword123!",
                "confirm_password": "NewSecretPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Password reset successfully.")

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecretPassword123!"))

    def test_confirm_password_reset_token_replay_rejected(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        # First reset succeeds
        first_response = self.client.post(
            "/api/auth/reset-password/",
            {
                "uid": uid,
                "token": token,
                "new_password": "FirstNewPassword123!",
                "confirm_password": "FirstNewPassword123!",
            },
            format="json",
        )
        self.assertEqual(first_response.status_code, 200)

        # Second attempt with same token must fail
        second_response = self.client.post(
            "/api/auth/reset-password/",
            {
                "uid": uid,
                "token": token,
                "new_password": "SecondNewPassword123!",
                "confirm_password": "SecondNewPassword123!",
            },
            format="json",
        )
        self.assertEqual(second_response.status_code, 400)
        self.assertFalse(second_response.data["success"])

    def test_confirm_password_reset_mismatched_passwords(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/auth/reset-password/",
            {
                "uid": uid,
                "token": token,
                "new_password": "FirstPassword123!",
                "confirm_password": "DifferentPassword123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("Passwords do not match.", str(response.data))

    def test_confirm_password_reset_missing_required_fields(self):
        response = self.client.post(
            "/api/auth/reset-password/",
            {
                "uid": "xyz",
                "token": "",
                "new_password": "",
                "confirm_password": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
