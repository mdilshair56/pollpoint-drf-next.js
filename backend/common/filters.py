"""Query-parameter filters for the Poll and PollResults list endpoints."""

from django_filters import rest_framework as filters
from polls.models import Poll


class PollFilter(filters.FilterSet):
    # Filter polls using the choices already defined by the Poll model.
    status = filters.ChoiceFilter(choices=Poll.Status.choices)
    result_visibility = filters.ChoiceFilter(
        choices=Poll.ResultVisibility.choices
    )

    # Filter by poll creator ID
    user_id = filters.NumberFilter(field_name="created_by__id")

    # Filter by poll creator's name (first name, last name, or username)
    user_name = filters.CharFilter(method="filter_by_user_name")

    # Date/time filters
    created_after = filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="gte",
    )
    created_before = filters.IsoDateTimeFilter(
        field_name="created_at",
        lookup_expr="lte",
    )
    starts_after = filters.IsoDateTimeFilter(
        field_name="starts_at",
        lookup_expr="gte",
    )
    starts_before = filters.IsoDateTimeFilter(
        field_name="starts_at",
        lookup_expr="lte",
    )
    ends_after = filters.IsoDateTimeFilter(
        field_name="ends_at",
        lookup_expr="gte",
    )
    ends_before = filters.IsoDateTimeFilter(
        field_name="ends_at",
        lookup_expr="lte",
    )

    class Meta:
        model = Poll
        fields = [
            "status",
            "result_visibility",
            "user_id",
            "user_name",
        ]

    def filter_by_user_name(self, queryset, name, value):
        if not value:
            return queryset
        from django.db.models import Q
        return queryset.filter(
            Q(created_by__first_name__icontains=value)
            | Q(created_by__last_name__icontains=value)
            | Q(created_by__username__icontains=value)
        )
