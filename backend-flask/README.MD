# Flask Task Tracker API

Uses Flask, PostgreSQL, bcrypt, and JWT authentication.

## Setup

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create a PostgreSQL database and run `schema.sql` against it.

Create a local `.env` containing:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET_KEY=YOUR_GENERATED_SECRET
```

Replace the placeholders with your local settings. Never commit `.env`.

Existing tasks must be assigned to their intended users before making
`tasks.user_id` required. Unowned tasks are hidden by the protected API.

## Run

```powershell
python app.py
```

The API runs at `http://localhost:5001`.

## Authentication

- `POST /api/auth/register` creates an account.
- `POST /api/auth/login` returns a token valid for one hour.
- `GET /api/auth/me` returns the authenticated user.

Send `Authorization: Bearer <token>` with every task request.

Missing, invalid, or expired tokens return 401. Requests for another
user's task return 404.

## React connection

Set `VITE_API_URL=http://localhost:5001` in `frontend-react/.env`,
then restart Vite. React keeps the token in memory, so refreshing
requires logging in again.

## Tests

Tests use a separate PostgreSQL database named `task_tracker_test`.

Create that database, run `schema.sql` against it, and set
`TEST_DATABASE_URL` in the local backend `.env`. Never point it
at the application database.

With the virtual environment active, run from `backend-flask`:

```powershell
python -m pytest -v
```

The fixture rolls back test changes after each test.

Coverage includes registration, login, authentication requirements,
task creation, title validation, missing tasks, updates, deletion,
and isolation between users.