from rest_framework.permissions import BasePermission, SAFE_METHODS

from polls.models import Poll


def is_admin(user):
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.role in ("admin", "superadmin"))
    )


class PollObjectPermission(BasePermission):
    """Any authenticated user may read visible polls; only owners/admins write."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, poll: Poll):
        if request.method in SAFE_METHODS:
            return True
        return is_admin(request.user) or poll.created_by_id == request.user.pk
