from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from common.exceptions import APIValidationError


class TokenService:

    @staticmethod
    def logout(*, refresh_token, user):
        # Check whether a refresh token was provided.
        if not refresh_token:
            raise APIValidationError({
                "refresh": "Refresh token is required to logout."
            })

        try:
            # Validate and load the refresh token.
            token = RefreshToken(refresh_token)

            # Ensure the token belongs to the authenticated user.
            if str(token.get("user_id")) != str(user.pk):
                raise TokenError(
                    "Refresh token does not belong to the authenticated user."
                )

            # Blacklist the refresh token.
            token.blacklist()

        except TokenError as exc:
            raise APIValidationError({
                "refresh": "Invalid or expired refresh token."
            }) from exc