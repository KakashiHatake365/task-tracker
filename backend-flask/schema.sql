-- SQLBook: Code
-- Active: 1794429698815@@127.0.0.1@5432
-- Active: 1794429698815@@127.0.0.1@5432
-- Run this script against the task_tracker PostgreSQL database.
-- Existing tables and task records are preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    done BOOLEAN DEFAULT FALSE,
    due_date DATE,
    tags TEXT[] DEFAULT '{}',
    user_id INTEGER NOT NULL REFERENCES users(id)
);

-- For databases created before authentication was added, add ownership
-- without deleting or assigning existing tasks to an arbitrary account.
-- This column stays nullable on those older databases until owners are set.
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);

COMMIT;

-- After assigning every existing task to its intended user, verify:
-- SELECT COUNT(*) FROM tasks WHERE user_id IS NULL;
-- If the count is zero, you can require ownership on the older database:
-- ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
