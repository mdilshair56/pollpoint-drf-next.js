# PollPoint – Full-Stack Polling Application

A full-stack polling platform built with **Django REST Framework** and **Next.js**, featuring secure authentication, role-based access, poll management, voting and results.

## Tech Stack

**Backend:** Python, Django, Django REST Framework  
**Frontend:** Next.js, React, TypeScript, Tailwind CSS  
**Database:** PostgreSQL  
**Background Tasks:** Celery, Celery Beat  
**Caching & Message Broker:** Redis  
**Authentication:** JWT, OTP, HTTP-only cookies

## Features

- User registration, login and email OTP verification.
- JWT authentication and password reset.
- Admin and Client roles with permission-based access.
- Poll creation and management.
- Multiple questions and answer options per poll.
- Draft, In Progress and Completed poll statuses.
- Voting with duplicate-vote prevention.
- Configurable result visibility.
- Automatic completion of expired polls using Celery.
- Search, filtering, ordering and pagination.
- Next.js frontend integrated with Django APIs.

## Project Structure

```text
Django_practice/
├── auth/           # Authentication and user management
├── polls/          # Polls, questions and voting
├── common/         # Shared utilities
├── core/           # Django configuration and Celery
├── frontend/       # Next.js application
├── manage.py
├── secrets.env     # Local environment variables
└── README.md
```

## Requirements

- Python
- Node.js and npm
- PostgreSQL
- Redis
- Git

## Environment Configuration

Create `secrets.env` in the project root.

Configure the following variables with your own credentials:

```env
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=your-secret-key

DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@127.0.0.1:5433/pollpoint

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email
EMAIL_HOST_PASSWORD=your-app-password

PASSWORD_RESET_FRONTEND_URL=http://localhost:3000/reset-password
PASSWORD_RESET_TIMEOUT=3600

CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0

LOGIN_OTP_TTL_SECONDS=180
LOGIN_OTP_MAX_ATTEMPTS=5

REDIS_BACKEND=django_redis.cache.RedisCache
REDIS_URL=redis://127.0.0.1:6379/1
REDIS_CLIENT_CLASS=django_redis.client.DefaultClient
```

Never commit `secrets.env` or credentials to GitHub.

## Installation

### Backend

From the project root:

```bash
./.venv/bin/python manage.py migrate
./.venv/bin/python manage.py createsuperuser
```

### Frontend

```bash
cd frontend
npm install
```

## Running the Application

Start the application using four separate terminals.

**Terminal 1 – PostgreSQL, Redis and Django**

```bash
cd "/run/media/dilshair-zafar/0616A74316A7331B/Practice/Django_practice"

sudo systemctl start postgresql
sudo systemctl start redis-server

pg_isready -h 127.0.0.1 -p 5433
redis-cli ping

./.venv/bin/python manage.py runserver
```

**Terminal 2 – Celery Worker**

```bash
cd "/run/media/dilshair-zafar/0616A74316A7331B/Practice/Django_practice"

./.venv/bin/celery -A core worker --loglevel=info
```

**Terminal 3 – Celery Beat**

```bash
cd "/run/media/dilshair-zafar/0616A74316A7331B/Practice/Django_practice"

./.venv/bin/celery -A core beat \
    --loglevel=info \
    --schedule=/tmp/pollpoint-celerybeat-schedule
```

**Terminal 4 – Next.js Frontend**

```bash
cd "/run/media/dilshair-zafar/0616A74316A7331B/Practice/Django_practice/frontend"

npm run dev
```

Keep all four terminals running while using the application. Only one Celery Beat instance should run at a time.

## Application URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Django Backend | http://127.0.0.1:8000 |
| Django Admin | http://127.0.0.1:8000/admin |
| PostgreSQL | 127.0.0.1:5433 |
| Redis | 127.0.0.1:6379 |

## Useful Commands

**Django checks**

```bash
./.venv/bin/python manage.py check
```

**Database migrations**

```bash
./.venv/bin/python manage.py makemigrations
./.venv/bin/python manage.py migrate
```

**Frontend validation**

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

## Git Workflow

The project uses a single repository for both backend and frontend.

```bash
git switch -c feature/your-feature-name
git add .
git commit -m "Describe your changes"
git push -u origin feature/your-feature-name
```

Create a Pull Request on GitHub to merge changes into `main`.

---

**PollPoint – Secure Authentication. Smart Poll Management. Reliable Voting.**
