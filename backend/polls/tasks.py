from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from polls.models import Poll
from polls.services.poll_results import PollResultsService


@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)
def finalize_poll_and_email_report(poll_id):
    """Complete an ended poll and email its reports once, when requested."""
    with transaction.atomic():
        try:
            poll = (
                Poll.objects.select_for_update()
                .select_related("created_by")
                .get(pk=poll_id)
            )
        except Poll.DoesNotExist:
            return "Poll no longer exists."

        if poll.status == Poll.Status.DRAFT:
            return "Draft polls are not finalized."

        now = timezone.now()
        if poll.ends_at > now:
            finalize_poll_and_email_report.apply_async(
                args=(poll.pk,),
                eta=poll.ends_at,
            )
            return "Poll end time has not arrived; finalization rescheduled."

        if poll.status == Poll.Status.IN_PROGRESS:
            poll.status = Poll.Status.COMPLETED
            poll.save(update_fields=["status", "updated_at"])

        if not poll.email_report_on_completion or poll.report_email_sent_at:
            return "Poll completed; no report email is pending."
        if not (poll.email_report_excel or poll.email_report_pdf):
            raise ValueError("Select at least one report format before sending the email.")

        recipient = poll.created_by.email
        if not recipient:
            raise ValueError("The poll creator has no email address for the requested report.")

        report_data = PollResultsService.compute_results_for_polls([poll])[0]
        from polls.services.poll_reports import PollReportGenerator

        attachments = []
        if poll.email_report_excel:
            excel_report = PollReportGenerator.generate_excel(report_data)
            attachments.append((
                f"poll_{poll.pk}_results.xlsx",
                excel_report.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ))
        if poll.email_report_pdf:
            pdf_report = PollReportGenerator.generate_pdf(report_data, include_voters=True)
            attachments.append((
                f"poll_{poll.pk}_report.pdf",
                pdf_report.getvalue(),
                "application/pdf",
            ))

        format_names = [
            label
            for selected, label in (
                (poll.email_report_excel, "Excel Raw Report"),
                (poll.email_report_pdf, "Visual Branded PDF"),
            )
            if selected
        ]
        context = {
            "poll_name": poll.name,
            "creator_name": poll.created_by.get_full_name() or poll.created_by.username,
            "report_formats": format_names,
        }
        email = EmailMultiAlternatives(
            subject=f"Your poll report: {poll.name}",
            body=(
                f"Hello {context['creator_name']},\n\n"
                f"Your poll '{poll.name}' has ended. "
                f"Your selected reports ({', '.join(format_names)}) are attached."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        email.attach_alternative(
            render_to_string("auth/emails/poll_report.html", context),
            "text/html",
        )
        for attachment in attachments:
            email.attach(*attachment)
        if email.send(fail_silently=False) != 1:
            raise RuntimeError(f"Unable to deliver the poll report to {recipient}.")

        poll.report_email_sent_at = timezone.now()
        poll.save(update_fields=["report_email_sent_at", "updated_at"])

    return "Poll completed and report emailed."


@shared_task
def complete_expired_polls():
    """Recover expired polls and any report emails missed by an ETA task."""
    now = timezone.now()
    expired_ids = list(Poll.objects.filter(
        status=Poll.Status.IN_PROGRESS,
        ends_at__lte=now,
    ).values_list("pk", flat=True))
    completed_count = Poll.objects.filter(
        pk__in=expired_ids,
        status=Poll.Status.IN_PROGRESS,
    ).update(status=Poll.Status.COMPLETED, updated_at=now)

    pending_report_ids = Poll.objects.filter(
        status=Poll.Status.COMPLETED,
        email_report_on_completion=True,
        report_email_sent_at__isnull=True,
        ends_at__lte=now,
    ).values_list("pk", flat=True)
    for poll_id in pending_report_ids.iterator():
        finalize_poll_and_email_report.delay(poll_id)

    return completed_count
