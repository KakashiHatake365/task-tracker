# Task Tracker — Flask Backend

A REST API built using Python, Flask and PostgreSQL to manage tasks.

## Requirements

- Python
- PostgreSQL
- pip

## Setup

1. Navigate to the backend folder:

   `cd backend-flask`

2. Create a virtual environment:

   `python -m venv .venv`

3. Activate the virtual environment:

   `.\.venv\Scripts\Activate.ps1`

4. Install dependencies:

   `pip install -r requirements.txt`

5. Create a PostgreSQL database named `task_tracker`.

6. Run `schema.sql` in PostgreSQL.

7. Create a `.env` file and configure the database connection:

   `DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/task_tracker`

## Run the application

`python app.py`

The server runs at http://localhost:5001.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/tasks | Get all tasks |
| GET | /api/tasks/:id | Get a task |
| POST | /api/tasks | Create a task |
| PATCH | /api/tasks/:id | Update a task |
| DELETE | /api/tasks/:id | Delete a task |

## Testing

Use Postman to test the API endpoints.