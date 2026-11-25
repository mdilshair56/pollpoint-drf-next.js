from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("polls", "0006_poll_idx_poll_status_vis_created"),
    ]

    operations = [
        migrations.AddField(
            model_name="poll",
            name="email_report_on_completion",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="poll",
            name="report_email_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
