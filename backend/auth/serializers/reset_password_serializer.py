from rest_framework import serializers

from ..services.user import UserService


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    uid = serializers.CharField(required=False, allow_blank=True)
    token = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
        required=False,
        allow_blank=True,
    )
    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        required=False,
        allow_blank=True,
    )

    # Validates email (Step 1) or uid/token/passwords (Step 2) via UserService
    def validate(self, attrs):
        return UserService.validate_password_reset_data(attrs=attrs)
