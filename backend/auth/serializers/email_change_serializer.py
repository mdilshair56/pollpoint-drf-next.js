from rest_framework import serializers


class EmailChangeRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class EmailChangeVerifySerializer(serializers.Serializer):
    otp = serializers.RegexField(
        regex=r"^\d{6}$",
        error_messages={"invalid": "OTP must contain exactly six digits."},
    )
