from rest_framework import serializers
from auth.models.user import User

class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "role",
            "is_superuser",
        ]
        read_only_fields = fields

# Mini-serializer
class MiniUserSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = User
        fields = [
            "user_id",
            "first_name",
            "last_name",
        ]
        read_only_fields = fields
