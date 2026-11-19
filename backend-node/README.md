# Node Task Tracker API

An Express and MongoDB alternative to the Flask API. Accounts use bcrypt password
hashes and expiring JWT tokens. Every task route requires a valid Bearer token
and restricts reads, updates, deletion, and searches to the task owner.

## Setup and run

From `backend-node`:

```powershell
npm install
```

Create a local `.env` using `.env.example` as a template. Set `MONGODB_URI`,
`DB_NAME`, `PORT`, and `JWT_SECRET_KEY`. Generate a signing key locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `.env`; never commit the real key or database credentials.
Use a free port, such as 3001, if 3000 is occupied. Atlas also requires a database
user and an IP access-list entry for the computer running this server.

```powershell
npm start
```

Startup connects to MongoDB and creates a unique email index and a task-owner
index. Set React's `VITE_API_URL` to this server's address and restart Vite.

## Accounts and existing data

MongoDB accounts are separate from PostgreSQL accounts. Register an account on
this backend when switching from Flask; Flask tokens are not accepted here.

Existing tasks without a `userId` are preserved but hidden. Assign them to their
intended MongoDB users separately if they need to be retained in the UI. New
requests cannot choose or change their task owner.

## Endpoints

- `GET /api/health` is public.
- `POST /api/auth/register` returns public account details (201), or 400/409.
- `POST /api/auth/login` returns a one-hour token, or 401 for bad credentials.
- `GET /api/auth/me` returns the authenticated user.
- Task CRUD uses `/api/tasks` and `/api/tasks/:id` with a Bearer token.
- Listing supports `status`, `tag`, and a literal, case-insensitive `q` search.

Titles must contain 1-200 characters after trimming. `done` must be a boolean,
`tags` an array of strings, `description` text or null, and `dueDate` a real
YYYY-MM-DD calendar date or null. Invalid input returns JSON with status 400.
Missing or invalid tokens return 401; another user's task returns 404.

## Tests

```powershell
npm test
```

Tests exercise the HTTP API using an isolated collection double. They need no
running MongoDB, local `.env`, or real account. They cover authentication,
password hashing, ownership, CRUD, validation, search, and JSON errors. A live
MongoDB integration check is still needed before deployment.
