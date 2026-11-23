from django.contrib.auth import get_user_model
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auth.models.user_profile import UserProfile
from ..serializers import UserSerializer
from ..serializers.user_profile_serializer import UserProfileSerializer
from ..services.user import IsAdminRole
from rest_framework.exceptions import NotFound

from rest_framework.throttling import ScopedRateThrottle
from common.api.responses import success_response
from ..serializers.email_change_serializer import (
    EmailChangeRequestSerializer,
    EmailChangeVerifySerializer,
)
from ..services.email_change import EmailChangeService

User = get_user_model()


class UserViewSet(viewsets.ReadOnlyModelViewSet):

    """
    Handles:
      - GET /api/auth/users/
      - GET /api/auth/users/<id>/
      - GET /api/auth/users/me/
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]

    def get_throttles(self):
        if self.action == "request_email_change":
            throttle = ScopedRateThrottle()
            throttle.scope = "otp_request"
            return [throttle]
        if self.action == "verify_email_change":
            throttle = ScopedRateThrottle()
            throttle.scope = "otp_verify"
            return [throttle]
        return super().get_throttles()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        """GET /api/auth/users/me/"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["patch"],
        permission_classes=[IsAuthenticated],
        throttle_classes=[ScopedRateThrottle],
        url_path="me/email",
    )
    def request_email_change(self, request):
        """PATCH /api/auth/users/me/email/"""
        serializer = EmailChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_email = serializer.validated_data["email"]
        EmailChangeService.request_email_change(user=request.user, new_email=new_email)

        return success_response(
            message="A verification code has been sent to your new email address."
        )

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        throttle_classes=[ScopedRateThrottle],
        url_path="me/email/verify",
    )
    def verify_email_change(self, request):
        """POST /api/auth/users/me/email/verify/"""
        serializer = EmailChangeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = EmailChangeService.verify_email_change(
            user=request.user,
            submitted_otp=serializer.validated_data["otp"],
        )

        return success_response(
            data={"email": user.email},
            message="Email address updated successfully.",
        )


class ProfileViewSet(viewsets.ReadOnlyModelViewSet):

    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def _get_my_profile(self):
        try:
            return UserProfile.objects.get(user=self.request.user)
        except UserProfile.DoesNotExist:
            raise NotFound("Your profile does not exist.")

    @action(
        detail=False,
        methods=["get"],
        url_path="mine",
    )
    def my_profile(self, request):
        """GET /api/auth/profiles/mine/"""

        profile = self._get_my_profile()
        serializer = self.get_serializer(profile)

        return Response(serializer.data)

    @action(
        detail=False,
        methods=["patch"],
        url_path="update",
    )
    def update_my_profile(self, request):
        """PATCH /api/auth/profiles/mine/update/"""

        profile = self._get_my_profile()

        serializer = self.get_serializer(
            profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)
