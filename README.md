# PollPoint – Full-Stack Polling Application

A full-stack polling platform built with **Django REST Framework** and **Next.js**, featuring secure authentication, role-based access, poll management, voting, real-time analytics, exportable reports, and automated reporting.

## Tech Stack

- **Backend:** Python, Django, Django REST Framework
- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS
- **Database:** PostgreSQL
- **Background Tasks & Automation:** Celery, Celery Beat
- **Caching & Message Broker:** Redis
- **Data Export & Reporting:** `openpyxl` (Excel), `WeasyPrint` (Visual Branded PDF)
- **Data Visualization:** Recharts
- **Authentication:** JWT, OTP, HTTP-only cookies

## Features

- User registration, login, and email OTP verification.
- JWT authentication and secure password reset.
- Profile management with authenticated email change and verification.
- Admin, Superadmin, and Client roles with strict role-based access control.
- Admin invitations and invitation acceptance flow.
- Poll creation and management with configurable start and end dates.
- Multiple questions and answer options per poll.
- Draft, In Progress, and Completed poll statuses.
- Voting with duplicate-vote prevention and real-time validation.
- Configurable result visibility (`Live`, `After Submission`, `Polls End`, `Restricted`).
- **Poll Results & Real-Time Analytics:**
  - Dedicated Analytics page (`/polls/results`) with unified filtering, search, and pagination.
  - Interactive donut/pie charts with dynamic center response counters using Recharts.
  - Descending rank option breakdown with dual vertical columns and horizontal progress bars layout switcher.
  - Interactive voter hover tooltips displaying voter names per answer option.
  - Midnight gradient header banners with creator details and timing stats.
- **Exportable Reports & Downloads:**
  - **Raw Data (.xlsx):** Clean Excel reports generated using `openpyxl` with metadata, sequential Question Numbers (`Question 1`, `Question 2`), Option Numbers (`1`, `2`, `3`), vote counts, percentages, and voter lists.
  - **Visual Branded PDF:** Publication-ready branded PDF reports generated using `WeasyPrint` with SVG charts, luxury styling, and embedded voter boxes.
  - **Strict Export Permissions:** Admins/Superadmins can export any poll; regular clients can only export their own created polls.
- **Automated Reporting with Celery Beat:**
  - Automated poll completion when expiry time is reached.
  - Opt-in email report delivery (`Excel Raw Report` and/or `Visual Branded PDF`) sent directly to poll creators upon completion.
- Autocomplete suggestions for polls, questions, and answer options.
- Frontend notifications using React Hot Toast.

## Project Structure

```text
PollPoint/
├── backend/
│   ├── auth/
│   ├── polls/
│   │   ├── models/
│   │   ├── serializers/
│   │   ├── services/
│   │   │   ├── poll.py
│   │   │   ├── poll_reports.py    # Headless Excel and WeasyPrint PDF generator
│   │   │   └── poll_results.py    # Batched vote query & analytics service
│   │   ├── views/
│   │   │   ├── poll.py
│   │   │   └── poll_results.py    # Analytics & export endpoints
│   │   └── tasks.py               # Celery finalization & report mailing tasks
│   ├── common/
│   ├── core/
│   ├── manage.py
│   ├── requirements.txt
│   └── secrets.env
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/polls/results/ # Real-time analytics view
│   │   │   └── api/backend/[...path]/     # Streaming binary reverse proxy
│   │   ├── components/
│   │   │   ├── poll-results/              # Charts, cards, and export menus
│   │   │   └── dashboard/                 # Protected area layout & nav menu
│   │   ├── services/                      # API service clients
│   │   └── types/                         # TypeScript interfaces
│   ├── package.json
│   └── package-lock.json
│
├── .venv/               # Local Python environment
├── .gitignore
└── README.md
```

## Requirements

- Python 3.12+
- Node.js 20+ and npm
- PostgreSQL
- Redis
- Git

## Environment Configuration

Create `backend/secrets.env`:

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
DEFAULT_FROM_EMAIL=your-email

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

Create `frontend/.env.local` with the environment variables required by the frontend configuration:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Never commit environment files or credentials.

## Installation

### Backend

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate

pip install -r backend/requirements.txt

cd backend
python manage.py migrate
python manage.py createsuperuser
```

### Frontend

Open another terminal:

```bash
cd frontend
npm ci
```

## Running the Application

Start the application using four separate terminals.

**Terminal 1 – PostgreSQL, Redis and Django**

```bash
sudo systemctl start postgresql
sudo systemctl start redis-server

pg_isready -h 127.0.0.1 -p 5433
redis-cli ping

cd backend
../.venv/bin/python manage.py runserver
```

**Terminal 2 – Celery Worker**

```bash
cd backend
../.venv/bin/celery -A core worker --loglevel=info
```

**Terminal 3 – Celery Beat**

```bash
cd backend
../.venv/bin/celery -A core beat \
    --loglevel=info \
    --schedule=/tmp/pollpoint-celerybeat-schedule
```

**Terminal 4 – Next.js Frontend**

```bash
cd frontend
npm run dev
```

Keep all terminals running while using the application. Run only one Celery Beat instance.

## Application URLs

| Service             | URL                                                        |
| ------------------- | ---------------------------------------------------------- |
| Frontend            | [http://localhost:3000](http://localhost:3000)             |
| Poll Results Page   | [http://localhost:3000/polls/results](http://localhost:3000/polls/results) |
| Django Backend      | [http://127.0.0.1:8000](http://127.0.0.1:8000)             |
| Django Admin        | [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin) |
| PostgreSQL          | 127.0.0.1:5433                                             |
| Redis               | 127.0.0.1:6379                                             |

## API Endpoints for Poll Results & Exports

| Method | Endpoint | Description | Access |
| ------ | -------- | ----------- | ------ |
| `GET`  | `/api/poll-results/` | List eligible poll results with filters & pagination | Authenticated |
| `GET`  | `/api/poll-results/{id}/` | Get full breakdown and response metrics for a poll | Eligible Users |
| `GET`  | `/api/poll-results/{id}/export-excel/` | Download raw `.xlsx` spreadsheet | Admins or Poll Creator |
| `GET`  | `/api/poll-results/{id}/export-pdf/` | Download visual branded `.pdf` report | Admins or Poll Creator |

## Useful Commands

**Backend checks and migrations**

```bash
cd backend

../.venv/bin/python manage.py check
../.venv/bin/python manage.py makemigrations
../.venv/bin/python manage.py migrate
```

**Frontend validation**

```bash
cd frontend

npx tsc --noEmit
npm run lint
npm run build
```

## Git Workflow

The backend and frontend share one Git repository.

```bash
git switch main
git pull --ff-only origin main

git switch -c feature/your-feature-name

git add .
git commit -m "Describe your changes"
git push -u origin feature/your-feature-name
```

Create a Pull Request to merge changes into `main`.

---

**PollPoint – Secure Authentication. Smart Poll Management. Reliable Voting.**
