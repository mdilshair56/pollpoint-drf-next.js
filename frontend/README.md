## Running the Project Locally

Start the application using four separate terminals. Make sure PostgreSQL and Redis are running before starting the backend.

**Project directory:**

```bash
cd "/Project's-current directory"
```

### Terminal 1 — PostgreSQL, Redis & Django Backend

Start the database and Redis services, verify their connections, and start Django:

```bash
cd "/Project's-current directory"

# Start PostgreSQL
sudo systemctl start postgresql

# Start Redis
sudo systemctl start redis-server

# Verify PostgreSQL (configured on port 5433)
pg_isready -h 127.0.0.1 -p 5433

# Verify Redis (expected output: PONG)
redis-cli ping

# Start Django development server
./.venv/bin/python manage.py runserver
```

Django backend: `http://127.0.0.1:8000/`

### Terminal 2 — Celery Worker

Start the Celery worker to process background tasks, including OTP emails, password reset emails, invitations, and expired poll processing.

```bash
cd "/Project's-current directory"

./.venv/bin/celery -A core worker --loglevel=info
```

Keep this terminal running.

### Terminal 3 — Celery Beat Scheduler

Start Celery Beat to execute scheduled tasks.

```bash
cd "/Project's-current directory"

./.venv/bin/celery -A core beat \
    --loglevel=info \
    --schedule=/tmp/pollpoint-celerybeat-schedule
```

**Important:** Always use `-A core`. Do not start Beat using only `celery beat`.

The expired-poll task runs every 30 seconds and automatically changes eligible polls from `IN_PROGRESS` to `COMPLETED`.

Only one Beat instance should run at a time.

### Terminal 4 — Next.js Frontend

Start the Next.js development server:

```bash
cd "/Project's-current directory"

npm run dev
```

Frontend: `http://localhost:3000/`

---

### Application Services

| Service | Address / Configuration |
|---|---|
| Next.js Frontend | `http://localhost:3000` |
| Django Backend | `http://127.0.0.1:8000` |
| PostgreSQL | `127.0.0.1:5433` |
| Redis | `127.0.0.1:6379` |
| Celery Worker | Background task processing |
| Celery Beat | Scheduled task execution (30 seconds) |

### Shutting Down

To stop the application:

1. Press `CTRL + C` in Terminal 4 to stop Next.js.
2. Press `CTRL + C` in Terminal 3 to stop Celery Beat.
3. Press `CTRL + C` in Terminal 2 to stop the Celery Worker.
4. Press `CTRL + C` in Terminal 1 to stop Django.

PostgreSQL and Redis remain managed as system services. Stop them separately only when needed:

```bash
sudo systemctl stop redis-server
sudo systemctl stop postgresql
```

**Note:** Start all four terminals whenever you want to run the complete application. PostgreSQL and Redis are started through their system services in Terminal 1.


# Pollpoint — Django Auth & Polls Frontend

A Next.js frontend for the existing Django REST Framework Auth and Polls applications.

> **Scope:** This implementation changed files under `Django_practice/frontend/` only. Django apps, settings, models, serializers, services, Redis configuration, Celery tasks, migrations, and database files were inspected for integration context but were not edited.

---

## 1. Architecture

The frontend and backend are separate applications:

```text
Browser
  |
  | same-origin requests
  v
Next.js UI (localhost:3000)
  |
  +-- React pages and components
  +-- typed AuthService / PollService
  +-- API Route Handlers
  |     |
  |     +-- HttpOnly access/refresh cookies
  |     +-- refresh and retry expired access tokens
  |     +-- server-to-server requests
  |
  v
Django REST Framework (localhost:8000)
  |
  +-- auth app
  +-- polls app
  +-- Django ORM
  |
  +-- configured database (this checkout currently uses SQLite)
  +-- Redis cache (OTP challenge storage)
  +-- Celery worker (OTP and password-reset email tasks)
```

The browser never connects directly to the database, Redis, or Celery. Django owns persistence, validation, permissions, OTP generation, and background email delivery.

### Why use a Next.js API proxy?

Django currently returns JWT access and refresh tokens in JSON and expects an `Authorization: Bearer <access>` header. It does not set HttpOnly authentication cookies itself.

The Next.js Route Handlers provide a small same-origin boundary:

1. The browser posts credentials to a Next.js session route.
2. Next.js sends that request to the existing Django endpoint.
3. Next.js reads the JWT values from Django's response.
4. Next.js sets HttpOnly cookies and returns only safe user data to browser JavaScript.
5. Protected browser requests go to the Next.js backend proxy.
6. The proxy reads the cookie on the server and adds the Bearer header when it calls Django.
7. If Django returns 401, the proxy attempts one refresh using the refresh cookie, then retries the original request.

The cookies use `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. Unsafe session and proxy requests also validate the request origin using the Origin header, then Referer or Fetch Metadata when Origin is absent. The access-cookie lifetime is aligned with the current Django access-token lifetime (10 minutes); the refresh-cookie lifetime is aligned with the current refresh-token lifetime (1 day).

This approach avoids exposing the tokens to browser JavaScript and avoids browser-to-Django cross-origin requests. Therefore, CORS configuration was not added to Django.

**Alternative:** Django could set cookies directly and implement CSRF protection for cookie-authenticated API requests. That is a valid design, but it requires backend changes. Another common choice is storing JWTs in browser storage; that is simpler to demonstrate but exposes tokens to JavaScript and is not the design selected here.

---

## 2. Technology choices

| Technology | Use in this project | Why |
|---|---|---|
| Next.js App Router | Routes, layouts and server Route Handlers | File-based routing and server-side endpoints |
| React | Interactive forms, poll controls and UI state | Component-based interface |
| TypeScript | API models and component/service contracts | Catch mismatched field names and payload types early |
| Tailwind CSS v4 | Utility-based layout and styling | No separate component styling framework required |
| Native Fetch API | HTTP communication | Built into the runtime; no additional HTTP dependency |
| Native React state | Form and page state | Enough for the current feature set |

### Why native Fetch instead of Axios?

Axios is a popular alternative and offers interceptors and some convenience methods. We used native `fetch` because it is built in, keeps the dependency list small, and the Next.js server proxy owns token refresh. The shared `ApiClient` class provides a single place for parsing responses and throwing typed errors.

### Why not React Hook Form and Zod yet?

They are useful for large forms and complex client-side validation. The current forms are small enough to use standard HTML validation and React state. Django remains the final validation authority. We can add React Hook Form/Zod when the form rules grow.

### Object-oriented structure

The API layer uses classes:

- `ApiClient` is responsible for HTTP requests and common error handling.
- `AuthService` represents authentication/profile operations.
- `PollService` represents poll and voting operations.

The UI uses function components, which is the normal modern React approach. We do not create class-based React components just to force OOP into the UI. This gives the application a simple separation between presentation, API communication, types, and server concerns.

---

## 3. Brand system

The selected visual palette is defined in `src/app/globals.css`:

| Token | Hex | Use |
|---|---|---|
| Brand / headers | `#1E3A8A` | Headings, branding, navigation |
| Interactive | `#3B82F6` | Main buttons, links, focused/selected states |
| Accent | `#F97316` | High-priority action such as Cast Vote |
| Surface | `#F8FAFC` | Main light background |
| Ink | `#0F172A` | Main text |

The starter's Geist font is retained as the modern sans-serif font. The visual system is intentionally small and uses shared CSS classes such as `.field`, `.field-label`, `.btn-primary`, `.btn-secondary`, `.btn-accent`, and `.panel`.

---

## 4. Project structure and file responsibilities

```text
frontend/
├── public/                         # Static files served as-is
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx          # Shared centered layout for authentication screens
│   │   │   ├── login/page.tsx      # Password and email-code sign-in page
│   │   │   ├── register/page.tsx   # Signup page
│   │   │   ├── forgot-password/page.tsx # Password reset request/confirmation
│   │   │   └── verify-otp/page.tsx # Redirects to the OTP sign-in mode
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Wraps dashboard routes in the session guard
│   │   │   ├── dashboard/page.tsx  # Dashboard overview and recent polls
│   │   │   ├── polls/page.tsx      # Search, filters, sorting and pagination
│   │   │   ├── polls/new/page.tsx  # Poll creation screen
│   │   │   ├── polls/[id]/page.tsx # Dynamic poll detail/voting route
│   │   │   └── profile/page.tsx    # Current user's profile page
│   │   ├── api/
│   │   │   ├── session/
│   │   │   │   ├── login/route.ts       # Password login; sets HttpOnly JWT cookies
│   │   │   │   ├── signup/route.ts      # Forwards signup to Django
│   │   │   │   ├── request-otp/route.ts # Requests backend email OTP
│   │   │   │   ├── verify-otp/route.ts  # Verifies OTP, loads user and sets cookies
│   │   │   │   ├── refresh/route.ts     # Explicit session refresh endpoint
│   │   │   │   ├── me/route.ts          # Returns the signed-in user; refreshes when needed
│   │   │   │   ├── logout/route.ts      # Attempts backend blacklist then clears cookies
│   │   │   │   └── password-reset/route.ts # Forwards reset request/confirmation
│   │   │   └── backend/[...path]/route.ts # Authenticated server-side Django API proxy
│   │   ├── favicon.ico
│   │   ├── globals.css             # Brand tokens and shared styling
│   │   ├── layout.tsx              # Root HTML layout, fonts and metadata
│   │   └── page.tsx                # Public landing page
│   ├── components/
│   │   ├── common/
│   │   │   └── page-heading.tsx    # Shared, typed page heading with optional actions
│   │   ├── auth/
│   │   │   ├── login-form.tsx      # Password login and email OTP interaction
│   │   │   ├── signup-form.tsx     # Registration form; sends Client role
│   │   │   └── password-reset-form.tsx # Two-stage reset form
│   │   ├── dashboard/
│   │   │   ├── protected-area.tsx  # Checks current session and provides app navigation
│   │   │   └── profile-view.tsx    # Loads and displays profile data
│   │   └── polls/
│   │       ├── poll-list.tsx       # Poll table/list, filters and page controls
│   │       ├── create-poll-form.tsx # Dynamic questions and answer options
│   │       └── poll-detail.tsx     # Poll detail and vote submission
│   ├── lib/
│   │   ├── api/api-client.ts       # Shared browser-side Fetch wrapper and ApiError
│   │   └── server/
│   │       ├── backend.ts          # Server-only Django base URL and JSON helper
│   │       └── session.ts          # Cookie names, cookie settings, refresh helper
│   ├── services/
│   │   ├── auth-service.ts         # OOP service for authentication/profile requests
│   │   └── poll-service.ts         # OOP service for poll, filter and vote requests
│   ├── types/
│   │   ├── api.ts                  # Standard and paginated API response types
│   │   ├── auth.ts                 # User, profile and authentication payload types
│   │   └── poll.ts                 # Poll, question, option, filter and vote types
│   └── utils/errors.ts             # Converts API errors into displayable messages
├── .env.example                    # Safe environment-variable template
├── .env.local                      # Local backend URL; ignored by Git
├── package.json                    # Dependencies and npm scripts
├── package-lock.json               # Locked dependency versions
├── tsconfig.json                   # Strict TypeScript and @/src import alias
├── next.config.ts                  # Next.js configuration
└── eslint.config.mjs               # ESLint rules
```

### Important folder rules

- `app/` owns routes and layouts. A folder becomes a URL segment when it contains a `page.tsx`.
- Parenthesized folders such as `(auth)` and `(dashboard)` are route groups. Their names are not included in the URL.
- `[id]` is a dynamic URL segment. For example, `/polls/12` renders the same page component with poll ID 12.
- `components/` contains reusable UI and page sections.
- `services/` contains application operations that call the API.
- `types/` describes data exchanged with Django.
- `lib/server/` contains server-only code. Never import it into a Client Component.
- `utils/` contains small general helpers.

The root app router is in `src/app`. The original generated starter files were consolidated there; there is not a second active App Router tree.

---

## 5. Authentication and cookie flow

### Password login

1. The user submits username and password.
2. `LoginForm` calls `AuthService.login()`.
3. `ApiClient` posts to `/api/session/login/` on Next.js.
4. The Next.js handler forwards the request to Django `POST /api/auth/login/`.
5. Django returns `success`, `message`, and `data.access`, `data.refresh`, `data.user`.
6. Next.js stores the two tokens in HttpOnly cookies and returns only `data.user` to the browser.

The login field is **username**, not email, because this checkout uses Django's default `AbstractUser.USERNAME_FIELD` and the standard SimpleJWT token serializer. If the backend authentication identifier is changed later, update the frontend to match.

### Email OTP login

1. The user chooses Email code and submits an email address.
2. Next.js forwards the address to `POST /api/auth/login/request-otp/`.
3. Django creates and stores the OTP challenge in Redis using the configured expiry and attempt limit.
4. Django queues the email task through Celery.
5. The user submits the six-digit code.
6. Next.js forwards it to `POST /api/auth/login/verify-otp/`.
7. Django validates the OTP and returns JWTs.
8. Next.js uses the new access token to load `/api/auth/users/me/`, sets HttpOnly cookies, and returns the user.

The browser never reads the OTP cache and never calls Redis or Celery directly.

### Logout and refresh

- The API proxy adds the access token as a Bearer header.
- When an API request receives 401, the proxy attempts one refresh with the refresh cookie and retries the request.
- Logout attempts to refresh first, calls Django's logout endpoint to blacklist the current refresh token, and clears both cookies regardless.
- A refresh token can no longer be used from this browser after local cookies are cleared.

### Password reset

The reset page supports both stages of the existing Django reset serializer:

- Request a reset email using an email address.
- Confirm a new password using `uid`, `token`, `new_password`, and `confirm_password` from the reset link.

**Backend environment dependency:** the existing `PASSWORD_RESET_FRONTEND_URL` value in the backend's private `../backend/secrets.env` should point to this frontend route, for example `http://localhost:3000/forgot-password` during local development. The backend app was not changed as requested, so verify this existing setting before testing reset emails.

---

## 6. Django endpoints used by the frontend

| Frontend operation | Existing Django endpoint | Method |
|---|---|---|
| Signup | `/api/auth/signup/` | POST |
| Password login | `/api/auth/login/` | POST |
| Request OTP | `/api/auth/login/request-otp/` | POST |
| Verify OTP | `/api/auth/login/verify-otp/` | POST |
| Refresh JWT | `/api/auth/token/refresh/` | POST |
| Logout / blacklist refresh | `/api/auth/logout/` | POST |
| Current user | `/api/auth/users/me/` | GET |
| Current profile | `/api/auth/profiles/mine/` | GET |
| Password reset request/confirm | `/api/auth/reset-password/` | POST |
| Poll list | `/api/polls/` | GET |
| Poll details | `/api/polls/{id}/` | GET |
| Detailed poll collection | `/api/polls/details/` | GET |
| Create poll with nested questions/options | `/api/polls/` | POST |
| Submit votes | `/api/polls/vote/` | POST |

Browser code calls Next.js session routes or `/api/backend/...`; the handlers forward requests to these Django endpoints.

### Poll query parameters

The list screen uses the filters already defined in `common/filters.py` and the DRF filter backends:

- `search`: searches poll name and description.
- `status`: `draft`, `in_progress`, or `completed`.
- `result_visibility`: `live`, `after_submission`, `polls_end`, or `restricted`.
- `ordering`: `name`, `-name`, `created_at`, `-created_at`, `starts_at`, `-starts_at`, `ends_at`, or `-ends_at`.
- `created_after`, `created_before`, `starts_after`, `starts_before`, `ends_after`, `ends_before`: ISO date-time values.
- `page`, `page_size`: page number and requested page size.

The list response uses `data` for the current page and a separate `pagination` object containing `count`, `next`, `previous`, `page`, `page_size`, and `total_pages`. The frontend reads that exact shape.

### Vote payload mapping

The poll detail screen sends:

```json
{
  "polls": [
    {
      "poll_id": 12,
      "votes": [
        {
          "question_id": 45,
          "answer_option_id": 81
        }
      ]
    }
  ]
}
```

Here, `question_id` is the ID of the **PollQuestion relationship row** displayed as the poll question. The existing Django `VoteCastSerializer` maps that public field to the service's `poll_question_id`. The frontend follows that existing contract.

---

## 7. Filters, pagination and results

- Poll filters are sent to Django as query parameters; filtering is not recreated in the browser.
- Page number and page size are sent to Django; pagination is not simulated by slicing a downloaded list.
- Search and ordering use the backend's configured DRF filter backends.
- Poll visibility is determined by the backend queryset. The frontend only displays the returned records.
- Voting is enabled in the UI only for polls whose returned status is `in_progress`; Django remains authoritative and validates the vote.

**Current backend limitation:** the inspected API provides vote submission and a confirmation response, but no endpoint for aggregate result totals or per-option counts. The frontend therefore displays the user's submitted answers and does not invent charts or percentages. Aggregate results can be added when a backend results endpoint exists.

---

## 8. Redis, Celery and the database

The existing backend settings in this checkout show:

- Django's database engine is currently SQLite using `db.sqlite3`.
- Redis is configured as Django's cache backend and is used by the OTP service for challenge storage, expiry and attempt counting.
- Celery is configured with broker and result-backend values loaded from the backend's private environment configuration.
- OTP and password-reset emails are dispatched through the existing Celery tasks.

The frontend does **not** open database sessions or connect directly to SQLite/PostgreSQL. A browser-to-database connection would bypass Django's serializers, service validation, permissions and transactions. The correct boundary is browser → Next.js → Django API → database.

The Redis process was present on `127.0.0.1:6379` during inspection. Start the Celery worker separately when testing email delivery:

```bash
cd /path/to/Django_practice
source .venv/bin/activate
celery -A core worker --loglevel=info
```

This command is based on the existing `core/__init__.py` export of `celery_app`. The frontend does not start or manage the worker.

---

## 9. Local development

### Backend terminal

From the project root:

```bash
cd /path/to/Django_practice
source .venv/bin/activate
python manage.py runserver 127.0.0.1:8000
```

Ensure Redis is running. Start a Celery worker in another terminal for OTP and email tasks.

### Frontend terminal

```bash
cd /path/to/Django_practice/frontend
npm install
npm run dev
```

Open:

- Public landing page: http://localhost:3000
- Login: http://localhost:3000/login
- Registration: http://localhost:3000/register
- Password reset: http://localhost:3000/forgot-password
- Dashboard: http://localhost:3000/dashboard
- Poll list: http://localhost:3000/polls

The local environment file is `.env.local`:

```env
DJANGO_API_BASE_URL=http://127.0.0.1:8000
```

This is a server-only variable. Do not rename it to `NEXT_PUBLIC_DJANGO_API_BASE_URL`; the backend base URL does not need to be exposed to browser JavaScript.

---

## 10. Validation performed

The following frontend checks passed after implementation:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The production build generated the landing, authentication, dashboard, poll, profile and API routes successfully.

A successful frontend build confirms compilation and static checks. It does not prove that every authenticated API action works against live data. End-to-end checks still require the Django server, the configured Redis service, the Celery worker for email actions, and valid test accounts.

---

## 11. Important backend observations (not changed)

These are recorded so they are not mistaken for frontend problems. They were deliberately left untouched because this task is frontend-only.

1. **Public signup role safety:** the current signup serializer accepts a writable `role` field, and `UserService.create_user()` promotes the user to staff/superuser when that role is `admin`. The frontend always sends `role: "client"`, but browser-side values can be modified by a malicious caller. The backend should enforce Client on public signup and reserve admin assignment for a trusted admin workflow. This needs a backend change in a separate task.
2. **Poll permissions:** the current `PollViewSet` uses `IsAuthenticated`. The frontend does not treat hiding a button or link as a security boundary; Django permissions remain authoritative.
3. **Password reset link:** the backend's `PASSWORD_RESET_FRONTEND_URL` needs to point to this frontend's `/forgot-password` route.
4. **Login identifier:** this checkout's standard SimpleJWT serializer authenticates using the Django username field. The password login form therefore asks for username rather than email.

---

## 12. Other ways to implement this later

| Concern | Current basic choice | Other valid option |
|---|---|---|
| HTTP | Native Fetch in `ApiClient` | Axios with interceptors |
| Forms | HTML forms and React state | React Hook Form |
| Client validation | Native browser constraints plus Django validation | Zod schema validation |
| Authentication | Next.js proxy with HttpOnly JWT cookies | Django-managed cookies/CSRF or a dedicated BFF/auth service |
| UI styling | Tailwind utility classes and shared CSS tokens | CSS Modules or a component library |
| Data fetching | Service classes called from components | TanStack Query/SWR for caching, retries and server-state synchronization |
| Global state | Local component state | React Context or a state library when shared state becomes more complex |

The current selection keeps the number of moving parts small and matches the existing Django API without requiring backend edits.

---

## 13. Why this work was done

This frontend creates a usable UI for the existing Auth and Polls backend:

- Authentication pages call the existing signup, password login, OTP login and password-reset endpoints.
- JWTs are held in HttpOnly cookies managed by Next.js server routes rather than browser localStorage.
- Protected pages check the current user through the existing Django endpoint.
- Profile details come from the existing profile endpoint.
- Poll list filters, sorting and pagination are sent to Django's existing filter and pagination implementation.
- Poll creation sends the nested payload expected by `PollServices.mega_poll()`.
- Poll details display existing question and answer-option records.
- Voting sends the existing serializer's expected field names.
- Shared types, service classes and the API client avoid duplicating API request code.
- The README records each file's purpose, the reason for the architecture, and alternatives for later improvements.

No backend files were changed as part of this implementation.
