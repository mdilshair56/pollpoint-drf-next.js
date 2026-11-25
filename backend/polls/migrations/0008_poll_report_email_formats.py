from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("polls", "0007_poll_report_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="poll",
            name="email_report_excel",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="poll",
            name="email_report_pdf",
            field=models.BooleanField(default=False),
        ),
    ]
