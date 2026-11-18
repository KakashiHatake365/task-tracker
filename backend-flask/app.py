
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from psycopg.rows import dict_row
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import g
import psycopg
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not configured.")

# Database connection
def get_db():
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )

# Password
def hash_password(password):
    password_bytes = password.encode("utf-8")

    if not 1 <= len(password_bytes) <= 72:
        raise ValueError("Password must be between 1 and 72 bytes")

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")


def check_password(password, stored_hash):
    password_bytes = password.encode("utf-8")

    if not 1 <= len(password_bytes) <= 72:
        return False

    return bcrypt.checkpw(
        password_bytes,
        stored_hash.encode("utf-8")
    )

# Required authentication 
def require_auth(route):
    @wraps(route)
    def wrapped(*args, **kwargs):
        parts = request.headers.get("Authorization", "").split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authentication required"}), 401

        try:
            payload = jwt.decode(
                parts[1],
                JWT_SECRET_KEY,
                algorithms=["HS256"],
                options={"require": ["sub", "iat", "exp"]}
            )

            subject = payload["sub"]

            if not isinstance(subject, str) or not subject.isascii() or not subject.isdigit():
                return jsonify({"error": "Invalid token"}), 401

            user_id = int(subject)

            if not 1 <= user_id <= 2147483647:
                return jsonify({"error": "Invalid token"}), 401

        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid or expired token"}), 401

        with get_db() as conn:
            user = conn.execute(
                "SELECT id, email FROM users WHERE id = %s",
                (user_id,)
            ).fetchone()

        if user is None:
            return jsonify({"error": "Invalid token"}), 401

        g.current_user = user
        return route(*args, **kwargs)

    return wrapped

# Format task response
def format_task(task):
    task = dict(task)
    task["dueDate"] = (
        task["due_date"].isoformat()
        if task["due_date"] else None
    )
    del task["due_date"]
    task["userId"] = task.pop("user_id")
    return task


# Health check
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# Get all tasks
@app.get("/api/tasks")
@require_auth
def get_tasks():
    status = request.args.get("status")
    tag = request.args.get("tag")

    query = "SELECT * FROM tasks WHERE user_id = %s"
    params = [g.current_user["id"]]

    if status == "open":
        query += " AND done = FALSE"
    elif status == "done":
        query += " AND done = TRUE"

    if tag:
        query += " AND %s = ANY(tags)"
        params.append(tag)

    query += " ORDER BY id"

    with get_db() as conn:
        tasks = conn.execute(query, params).fetchall()

    return jsonify([format_task(task) for task in tasks])


# Get one task
@app.get("/api/tasks/<int:id>")
@require_auth
def get_task(id):
    with get_db() as conn:
        task = conn.execute(
            "SELECT * FROM tasks WHERE id = %s AND user_id = %s",
            (id, g.current_user["id"])
        ).fetchone()

    if task is None:
        return jsonify({"error": "Task not found"}), 404

    return jsonify(format_task(task))


# Create a task
@app.post("/api/tasks")
@require_auth
def create_task():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    title = data.get("title", "")

    if not isinstance(title, str) or not 1 <= len(title.strip()) <= 200:
        return jsonify({"error": "Title must be 1-200 characters"}), 400

    with get_db() as conn:
        task = conn.execute(
            """
            INSERT INTO tasks
            (title, description, done, due_date, tags, user_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                title.strip(),
                data.get("description"),
                data.get("done", False),
                data.get("dueDate"),
                data.get("tags", []),
                g.current_user["id"]
            )
        ).fetchone()

    return jsonify(format_task(task)), 201


# Update a task
@app.patch("/api/tasks/<int:id>")
@require_auth
def update_task(id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    with get_db() as conn:
        task = conn.execute(
            "SELECT * FROM tasks WHERE id = %s AND user_id = %s",
            (id, g.current_user["id"])
        ).fetchone()

        if task is None:
            return jsonify({"error": "Task not found"}), 404

        title = data.get("title", task["title"])

        if not isinstance(title, str) or not 1 <= len(title.strip()) <= 200:
            return jsonify({"error": "Title must be 1-200 characters"}), 400

        updated_task = conn.execute(
            """
            UPDATE tasks
            SET title = %s,
                description = %s,
                done = %s,
                due_date = %s,
                tags = %s
            WHERE id = %s AND user_id = %s
            RETURNING *
            """,
            (
                title.strip(),
                data.get("description", task["description"]),
                data.get("done", task["done"]),
                data.get("dueDate", task["due_date"]),
                data.get("tags", task["tags"]),
                id,
                g.current_user["id"]
            )
        ).fetchone()

    if updated_task is None:
        return jsonify({"error": "Task not found"}), 404

    return jsonify(format_task(updated_task))


# Delete a task
@app.delete("/api/tasks/<int:id>")
@require_auth
def delete_task(id):
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM tasks WHERE id = %s AND user_id = %s",
            (id, g.current_user["id"])
        )

        if result.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404

    return "", 204

# API Registration
@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "Email is required"}), 400

    if not isinstance(password, str) or not password:
        return jsonify({"error": "Password is required"}), 400

    email = email.strip().lower()

    if "@" not in email:
        return jsonify({"error": "Enter a valid email address"}), 400

    try:
        password_hash = hash_password(password)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    try:
        with get_db() as conn:
            user = conn.execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING id, email
                """,
                (email, password_hash)
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        return jsonify({"error": "Email is already registered"}), 409

    return jsonify(user), 201

# login 
@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Invalid email or password"}), 401

    with get_db() as conn:
        user = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = %s",
            (email.strip().lower(),)
        ).fetchone()

    if user is None or not check_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    now = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": str(user["id"]),
            "iat": now,
            "exp": now + timedelta(hours=1)
        },
        JWT_SECRET_KEY,
        algorithm="HS256"
    )

    return jsonify({"token": token}), 200


@app.get("/api/auth/me")
@require_auth
def me():
    return jsonify(g.current_user), 200


@app.errorhandler(psycopg.Error)
def handle_database_error(error):
    app.logger.exception("Database operation failed")
    return jsonify({"error": "Database operation failed"}), 500

# Run Flask
if __name__ == "__main__":
    app.run(debug=True, port=5001)
