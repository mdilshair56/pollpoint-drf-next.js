from rest_framework import serializers

from auth.models.invitation import AdminInvitation


class CreateInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class InvitationResponseSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=True)
    decision = serializers.ChoiceField(choices=["accept", "decline"])


class InvitationSerializer(serializers.ModelSerializer):
    invited_by_email = serializers.EmailField(source="invited_by.email", read_only=True)
    accepted_by_email = serializers.EmailField(source="accepted_by.email", read_only=True)

    class Meta:
        model = AdminInvitation
        fields = [
            "id", "email", "status", "invited_by_email", "accepted_by_email",
            "created_at", "expires_at", "responded_at",
        ]
        read_only_fields = fields


class PromoteUserSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)
    role = serializers.ChoiceField(choices=["client", "admin", "superadmin"])
