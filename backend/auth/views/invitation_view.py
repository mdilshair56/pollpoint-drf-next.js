from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth.serializers.invitation_serializer import (
    CreateInvitationSerializer,
    InvitationResponseSerializer,
    InvitationSerializer,
    PromoteUserSerializer,
)
from auth.services.invitation import InvitationService
from auth.services.role import RoleService
from auth.serializers.user_serializer import UserSerializer


class InvitationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invitations = InvitationService.list_for_admin(request.user)
        return Response({
            "success": True,
            "message": "Invitations retrieved.",
            "data": InvitationSerializer(invitations, many=True).data,
        })

    def post(self, request):
        serializer = CreateInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = InvitationService.create(
            email=serializer.validated_data["email"],
            invited_by=request.user,
        )
        return Response({
            "success": True,
            "message": "Invitation created. Email delivery has been queued.",
            "data": InvitationSerializer(invitation).data,
        }, status=status.HTTP_201_CREATED)


class InvitationPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        invitation = InvitationService.get_from_token(request.query_params.get("token"))
        return Response({
            "success": True,
            "message": "Invitation is valid.",
            "data": {
                "email": invitation.email,
                "invited_by": invitation.invited_by.get_full_name() or invitation.invited_by.username,
                "expires_at": invitation.expires_at,
            },
        })


class InvitationRespondView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InvitationResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = InvitationService.respond(
            raw_token=serializer.validated_data["token"],
            decision=serializer.validated_data["decision"],
            user=request.user if request.user.is_authenticated else None,
        )
        return Response({
            "success": True,
            "message": f"Invitation {invitation.status}.",
            "data": InvitationSerializer(invitation).data,
        })


class RolePromotionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PromoteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = RoleService.promote(
            actor=request.user,
            target_id=serializer.validated_data["user_id"],
            role=serializer.validated_data["role"],
        )
        return Response({
            "success": True,
            "message": f"User role updated to {user.role}.",
            "data": UserSerializer(user).data,
        })
