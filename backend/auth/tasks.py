from datetime import datetime

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone



#INVITATION EMAIL
@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_admin_invitation_email_task(email, accept_url, inviter_name, expires_at):
    expires = datetime.fromisoformat(expires_at)

    if timezone.is_naive(expires):
        expires = timezone.make_aware(
            expires,
            timezone.get_current_timezone()
        )

    expiry_label = timezone.localtime(expires).strftime(
        "%d %B %Y at %I:%M %p %Z"
    )

    subject = "You're invited to join Pollpoint"

    html_content = render_to_string(
        "auth/emails/invitation.html",
        {
            "invitation_email": email,
            "inviter_name": inviter_name,
            "accept_url": accept_url,
            "expires_at": expires,
            "expiry_label": expiry_label,
        },
    )

    text_content = (
        f"Hello,\n\n"
        f"{inviter_name} has invited you to join Pollpoint.\n\n"
        f"Accept or decline this invitation using the link below:\n"
        f"{accept_url}\n\n"
        f"This invitation expires on {expiry_label}.\n\n"
        "If you did not expect this invitation, you can ignore this email.\n"
    )

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )

    message.attach_alternative(html_content, "text/html")
    message.send(fail_silently=False)

# RESET PASSWORD EMAIL
@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_password_reset_email_task(email, reset_url):
    subject = "Reset Your Password"
    html_content = render_to_string(
        "auth/emails/reset_password.html",
        {"reset_url": reset_url},
    )
    text_content = (
        "Hello,\n\n"
        "We received a request to reset the password "
        "for your account.\n\n"
        "Use the link below to set a new password:\n"
        f"{reset_url}\n\n"
        "This link expires according to your password-reset policy.\n\n"
        "If you did not request a password reset, you can ignore "
        "this email. Your password will remain unchanged unless "
        "the reset process is completed.\n\n"
        "Best regards,\n"
        "The Security Team"
    )
    email_message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    email_message.attach_alternative(html_content, "text/html")
    email_message.send(fail_silently=False)


# OTP Request
@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_login_otp_email_task(email, otp):
    subject = "Login OTP"
    html_content = render_to_string(
        "auth/emails/login_otp.html",
        {"otp": otp},
    )
    text_content = (
        "Hello,\n\n"
        "We received a request to sign in to your account.\n\n"
        f"Your login verification code is: {otp}\n\n"
        "This code expires in 3 minutes.\n\n"
        "Never share this code with anyone.\n\n"
        "If you did not attempt to log in, "
        "please ignore this email and secure your account "
        "if you suspect unauthorized access.\n\n"
        "Best regards,\n"
        "The Security Team"
    )
    email_message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    email_message.attach_alternative(html_content, "text/html")
    email_message.send(fail_silently=False)

# EMAIL CHANGE OTP
@shared_task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_email_change_otp_task(email, otp):
    subject = "Verify Your New Email Address"
    html_content = render_to_string(
        "auth/emails/email_change_otp.html",
        {"otp": otp},
    )
    text_content = (
        "Hello,\n\n"
        "We received a request to change the email address for your Pollpoint account.\n\n"
        f"Your verification code is: {otp}\n\n"
        "This code expires in 3 minutes.\n\n"
        "Never share this code with anyone.\n\n"
        "If you did not request this change, you can safely ignore this email.\n"
        "Your account email remains unchanged until verified.\n\n"
        "Best regards,\n"
        "The Security Team"
    )
    email_message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    email_message.attach_alternative(html_content, "text/html")
    email_message.send(fail_silently=False)