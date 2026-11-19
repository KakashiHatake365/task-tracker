# Task Tracker

A learning project built through the Lektik Engineering Fundamentals lessons. It starts with a plain HTML and JavaScript task tracker, then adds APIs, a React frontend, authentication, tests, search, and deployment.

## Repository branches

The application stages are currently on separate branches. `main` contains the project documents until the stage pull requests are reviewed and merged. Select a stage branch on GitHub to view its code.

| Branch | Stage |
| --- | --- |
| `stage1-html` | HTML and JavaScript task tracker |
| `stage2-flask` | Flask API with PostgreSQL |
| `stage3-node` | Express API with MongoDB |
| `stage4-react` | React frontend connected to an API |
| `stage5-auth` | Registration, login, and private tasks |
| `stage6-testing` | Flask API tests |
| `stage7-ai-search` | Task search and additional validation tests |
| `stage8-deployment` | GitHub Actions and deployment configuration |

Later branches build on earlier work. The instructions below describe `stage8-deployment`; these folders are not yet present on `main`.

## Features

- Create, edit, complete, and delete tasks.
- Add descriptions, due dates, and tags.
- Filter tasks by status and tag; search titles and descriptions.
- Register, log in, and log out.
- Access only tasks belonging to the signed-in account.
- Connect React to either backend using `VITE_API_URL`.

## Stack

| Part | Technologies |
| --- | --- |
| Frontend | React and Vite |
| Main backend | Python, Flask, and PostgreSQL |
| Alternative backend | Node.js, Express, and MongoDB |
| Authentication | bcrypt password hashing and expiring JWTs |
| Checks | pytest, Node's test runner, ESLint, and GitHub Actions |
| Hosting | Render frontend/backend and Neon PostgreSQL |

## Local setup

Install Git, Python 3.14, Node.js 26, and PostgreSQL. MongoDB is needed only for the alternative backend.

Clone the repository and select the deployment branch:

```powershell
git clone https://github.com/KakashiHatake365/task-tracker.git
cd task-tracker
git switch stage8-deployment
```

### Flask and PostgreSQL

Create an application database in PostgreSQL and run `backend-flask/schema.sql` against it.

```powershell
cd backend-flask
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create `backend-flask/.env` with your own values:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET_KEY=REPLACE_WITH_A_RANDOM_SECRET
```

Generate a secret locally:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Run the API from `backend-flask`:

```powershell
python app.py
```

The local API runs at `http://localhost:5001`. Check `http://localhost:5001/api/health`.

### React

In a second terminal, from the repository root:

```powershell
cd frontend-react
npm ci
```

Create `frontend-react/.env`:

```env
VITE_API_URL=http://localhost:5001
```

Start the frontend:

```powershell
npm run dev
```

Open the address printed by Vite. Register an account before creating tasks. Login tokens are kept in memory, so refreshing the page requires logging in again.

### Alternative Node backend

From `backend-node`, run `npm ci`. Create a local `.env` containing `MONGODB_URI`, `DB_NAME`, `PORT`, and `JWT_SECRET_KEY`, then run `npm start`.

Set React's `VITE_API_URL` to the Node server's address and restart Vite. PostgreSQL and MongoDB use separate accounts and data; register again when switching backends. See `backend-node/README.md` on the stage branch for details.

## Checks

For Flask, create a separate database named `task_tracker_test`, run `backend-flask/schema.sql` against it, and set `TEST_DATABASE_URL` in `backend-flask/.env`. Tests must never use the application or hosted database.

From `backend-flask`, with its virtual environment active:

```powershell
python -m pytest -v
```

From `backend-node`:

```powershell
npm test
```

Node tests use an in-memory collection double; they do not verify a live MongoDB connection.

From `frontend-react`:

```powershell
npm run lint
npm run build
```

The deployment branch includes a GitHub Actions workflow for Flask tests, Node tests, and React lint/build checks on pushes and pull requests.

## Deployment

- Frontend: https://task-tracker-frontend-7zag.onrender.com/
- Backend health: https://task-tracker-api-8ayp.onrender.com/api/health

The services are deployed for testing. On 19 November 2026, 24 automated live HTTP checks passed, including registration, login, task persistence, and account isolation. The intentional CI failure and return to green were verified. A rollback between deployments of the same commit was reported complete, with health and login/task checks passing; recovery from a different code revision was not demonstrated. The full browser checklist and remaining review steps are tracked in DEPLOY.md. See [DEPLOY.md](DEPLOY.md) for results and remaining checks.

Set `DATABASE_URL` and `JWT_SECRET_KEY` on the Render backend. Set `VITE_API_URL` on the Render static site before building; changing it requires a rebuild. Allow the frontend's origin in the backend's CORS configuration. Keep database credentials and signing keys out of frontend settings and Git.

## Project documents

- [COMPARISON.md](COMPARISON.md): PostgreSQL and MongoDB comparison.
- [AI_LOG.md](AI_LOG.md): Implementation notes and verification log.
- [DEPLOY.md](DEPLOY.md): Hosting setup, verification results, troubleshooting, and rollback instructions.
