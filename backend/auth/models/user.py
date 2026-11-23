from enum import UNIQUE

from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models


class UserManager(DjangoUserManager):
    """Public account creation always creates a client; superusers are explicit."""

    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields["role"] = User.Role.CLIENT
        extra_fields["is_staff"] = False
        extra_fields["is_superuser"] = False
        return super().create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields["role"] = User.Role.SUPERADMIN
        if extra_fields["is_staff"] is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields["is_superuser"] is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        # Call Django's base create_user directly so the public create_user
        # override cannot reset the role to client.
        return super().create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        ADMIN = "admin", "Admin"
        CLIENT = "client", "Client"

    email = models.EmailField(blank=False, null=False, unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
    )
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    objects = UserManager()

    def __str__(self):
        return self.username
