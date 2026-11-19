from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView

from auth.serializers.login_otp_serializer import (
    LoginOTPRequestSerializer,
    LoginOTPVerifySerializer,
)
from auth.services.login_otp import LoginOTPService


class LoginOTPRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_request"

    def post(self, request):
        serializer = LoginOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        LoginOTPService.request_login_code(email=email)

        return Response(
            {
                "detail": "If an account exists for that email, a login code has been sent."
            },
            status=status.HTTP_200_OK,
        )


class LoginOTPVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        serializer = LoginOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        tokens = LoginOTPService.verify_login_code(
            email=email,
            submitted_otp=serializer.validated_data["otp"],
        )

        return Response(
            {
                "detail": "Login successful.",
                "refresh": tokens["refresh"],
                "access": tokens["access"],
            },
            status=status.HTTP_200_OK,
        )
