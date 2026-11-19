
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AdminInvitation, User, UserProfile


class CustomUserAdmin(UserAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_staff",
    )

    fieldsets = UserAdmin.fieldsets + (
        (
            "Additional Information",
            {"fields": ("phone_number", "role")},
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Additional Information",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "email",
                    "phone_number",
                    "role",
                )
            },
        ),
    )

class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "user__first_name",
        "user__last_name",
        "user__email",
        "user__phone_number",
        "city",
        "country",
        "date_of_birth",
    )


admin.site.register(User, CustomUserAdmin)
admin.site.register(UserProfile, UserProfileAdmin)


@admin.register(AdminInvitation)
class AdminInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "status", "invited_by", "created_at", "expires_at", "responded_at")
    list_filter = ("status", "created_at")
    search_fields = ("email", "invited_by__email")
    readonly_fields = ("token_hash", "created_at", "updated_at", "responded_at")
