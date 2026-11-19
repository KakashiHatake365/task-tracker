# Task Tracker Project Instructions

## Stack

- Frontend: React and Vite.
- Main backend: Flask and PostgreSQL.
- Alternative backend: Express and MongoDB.
- Authentication: bcrypt password hashes and expiring JWT tokens.

## Run commands

Flask, from backend-flask:

```powershell
.\.venv\Scripts\python.exe app.py
```

React, from frontend-react:

```powershell
npm run dev
```

Flask runs on port 5001. React reads its backend address from VITE_API_URL.

## Checks

From backend-flask:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Tests must use TEST_DATABASE_URL pointing to task_tracker_test. Never run tests against the application database.

From frontend-react:

```powershell
npm run lint
npm run build
```

## API rules

Follow the API contract in 07-Project-Task-Tracker.pdf.

- Keep existing paths, status codes, and response fields.
- Task requests require a valid Bearer token.
- Users can access only their own tasks.
- Assign task ownership on the server.
- Use parameterized SQL.
- Return JSON errors.
- Never expose passwords, hashes, signing keys, or tokens in logs.
- Never commit .env files.

## Current feature: task search

Add an optional q parameter to GET /api/tasks.

- Search titles and descriptions without case sensitivity.
- Treat search text literally, including % and _.
- An empty or whitespace-only search applies no search filter.
- Preserve ownership, status, and tag filtering.
- Keep the existing task response shape.
- Add API tests and a React search field.

## Workflow

Explain the plan before implementing. Keep changes focused on the requested feature. Review the diff and run relevant checks. Record implementation notes, corrections, and verification in AI_LOG.md.
