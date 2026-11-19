# Deployment

## Hosting

| Component | Host | Public address |
| --- | --- | --- |
| React frontend | Render Static Site | https://task-tracker-frontend-7zag.onrender.com/ |
| Flask API | Render Web Service | https://task-tracker-api-8ayp.onrender.com |
| PostgreSQL | Neon | Private connection string configured on the backend |

The hosted application uses Flask and PostgreSQL. The Node/MongoDB backend remains an alternative for local use.

Application code and CI are currently on `stage8-deployment`. The stage pull requests still need review and merging before switching the Render services to `main`. Updating these documents on `main` alone does not deploy the application code.

## Current verification

On 19 November 2026, 24 automated live HTTP checks passed with no failures. They covered frontend HTML and its bundled API address, API health, frontend CORS and login preflight, registration and login for two accounts, the authenticated profile, rejected incorrect passwords, required authentication, title validation, task creation with dates and tags, combined search/status/tag filters, editing and completion, persistence after a fresh login, per-user list/read/update/delete isolation, and deletion. Successful registration and task persistence exercised the hosted database through the API.

All tasks created by the checks were deleted. Two temporary accounts with addresses beginning `deployment-smoke-` remain because the API has no account-deletion endpoint. No existing user data was modified.

These were HTTP checks, not browser automation. Clicking through the React interface, refresh/logout behavior in the browser, the intentional CI failure, and the rollback exercise still need verification.

## 1. Prepare Neon

1. Create a Neon PostgreSQL project on the free plan, using a region close to the backend where possible.
2. Open the SQL Editor for the intended database.
3. Run the contents of `backend-flask/schema.sql` from the deployment branch.
4. Click **Connect** and copy the PostgreSQL connection string with connection pooling enabled. Preserve its SSL options.
5. Save that string as `DATABASE_URL` in the Render backend environment. Do not put it in React or commit it.

For a new database, confirm that both tables exist:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM tasks;
```

Both counts should initially be zero. Running the schema creates the tables; it does not copy accounts or tasks from local PostgreSQL. Register a new account in the hosted app.

## 2. Deploy the Flask backend

Connect the GitHub repository to a Render Web Service using these settings:

| Setting | Value |
| --- | --- |
| Branch during testing | `stage8-deployment` |
| Root directory | `backend-flask` |
| Runtime | Python |
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn app:app --bind 0.0.0.0:$PORT --access-logfile -` |
| Health check path | `/api/health` |

Set these environment variables in Render:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string, including SSL options |
| `JWT_SECRET_KEY` | Random production signing key; keep private |
| `PYTHON_VERSION` | Python version used for this deployment: `3.14.10` |

Generate a signing key locally if creating a new service:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Store the output only in the backend environment. Replacing an existing signing key invalidates existing login tokens.

Gunicorn imports `app` and does not execute the local `app.run(debug=True, ...)` block. Keep Flask debug mode disabled in the hosted environment. Render supplies `PORT`; the local PostgreSQL or Flask port is not a substitute for it.

Check:

```text
https://task-tracker-api-8ayp.onrender.com/api/health
```

Expected response:

```json
{"status":"ok"}
```

The API has no homepage at `/`; a 404 there is expected.

## 3. Deploy the React frontend

Create a Render Static Site connected to the same repository:

| Setting | Value |
| --- | --- |
| Branch during testing | `stage8-deployment` |
| Root directory | `frontend-react` |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |

Set these environment variables on the static site:

```env
VITE_API_URL=https://task-tracker-api-8ayp.onrender.com
NODE_VERSION=26
```

`VITE_API_URL` is a public API address. Vite includes it in the built JavaScript, so changing it requires **Save, rebuild, and deploy**. Local `.env` files are ignored by Git and do not configure the hosted service.

Do not use the old backend address `https://task-tracker-9glc.onrender.com`; the frontend was previously unable to connect through that address.

## 4. Allow the frontend origin

In `backend-flask/app.py`, configure CORS for `/api/*` to allow:

- `https://task-tracker-frontend-7zag.onrender.com`
- `http://localhost:5173` for local development

The local deployment checkout contains this change. Commit, push, and deploy it before relying on it in a fresh deployment. Update the allowed origin if the frontend hostname changes. CORS does not replace authentication or task ownership checks.

## 5. Verify the hosted application

Use the frontend over HTTPS:

1. Register a new account and log in.
2. Create a task with a description, due date, and tags.
3. Edit it, mark it complete, and check status, tag, and search filters.
4. Refresh the page and log in again. The saved task should remain; login tokens are kept in memory.
5. Delete the task and confirm it remains deleted after another refresh and login.
6. Register a second account and confirm it cannot see the first account's tasks.
7. Confirm an unauthenticated task request returns 401.

If a check fails, record the action and inspect the matching Render backend logs. Do not paste passwords, tokens, or full database connection strings into reports.

## CI and publishing changes

The deployment branch includes `.github/workflows/tests.yml`, which runs on pushes and pull requests:

- Flask tests against an isolated PostgreSQL service named `task_tracker_test`.
- Node API tests with an in-memory collection double.
- React lint and production build checks.

CI uses test settings, not the Neon database or production signing key. Check the actual workflow results before merging; the presence of the workflow does not establish that checks passed.

Share stage PRs with the lead for review. After the required stages are reviewed and merged and checks pass on `main`, change both Render services to deploy `main` and deploy the reviewed revision. Keep the current testing branch selected until `main` contains the application folders and workflow.

For later releases, open a branch and PR, wait for passing checks and review, then merge. Verify that Render deploys the intended commit, and repeat the browser checks. Run database changes deliberately; restarting Gunicorn does not run `schema.sql` automatically.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `JWT_SECRET_KEY is not configured` | Set it on the Render backend and redeploy. |
| Database operation failed | Read the backend traceback. Check the Neon URL, SSL options, database selection, and schema. |
| Could not reach the backend | Inspect the browser Network/Console panels for the actual request URL, network error, and CORS response. Verify `VITE_API_URL` on the static site and rebuild after changes. |
| Browser still uses an old API URL | Confirm the new frontend build finished, then hard-refresh or try a private window. |
| 404 at backend `/` | Use `/api/health` or an API route; open the frontend URL for the user interface. |
| Account works locally but not online | Local and Neon databases are separate; register on the hosted app. |
| Refresh logs the user out | Expected: tokens are stored in React memory. Log in again to view saved tasks. |

## Rollback

If a release breaks the app:

1. In the affected Render service, open **Deploys** and select a recent successful deployment.
2. Choose **Rollback** and confirm the target deployment.
3. Verify health and the browser workflow again. Check that the frontend API address and backend CORS settings still match.
4. Investigate the failed release and prepare a reviewed fix. After verification, re-enable automatic deploys if Render disabled them during rollback.

A service rollback does not undo changes made to the Neon database. Database changes need a compatible migration or a separate recovery plan. Do not use the hosted database for deliberate failure tests. Record the known working commit and the result when completing the lesson's rollback exercise; no successful rollback is claimed here yet.

## References

- [Render environment variables](https://render.com/docs/configure-environment-variables)
- [Render monorepo settings](https://render.com/docs/monorepo-support)
- [Render rollbacks](https://render.com/docs/rollbacks)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
