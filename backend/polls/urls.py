from django.urls import include, path
from rest_framework.routers import DefaultRouter
from polls.views.question import QuestionsList
from polls.views.poll import PollViewSet
from polls.views.vote import VoteCastView, VoteResultView


router = DefaultRouter()
router.register(r"polls", PollViewSet, basename="poll")

urlpatterns = [
    path("polls/vote/", VoteCastView.as_view(), name="vote-cast"),
    path(
        "polls/vote/results/",
        VoteResultView.as_view(),
        name="vote-results",
    ),
    path("", include(router.urls)),
    path(
        "questions/",
        QuestionsList.as_view({"get": "list"}),
        name="question-list",
    ),
]
