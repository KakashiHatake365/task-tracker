
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from psycopg.rows import dict_row
import psycopg
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL")


# Database connection
def get_db():
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )


# Format task response
def format_task(task):
    task["dueDate"] = (
        task["due_date"].isoformat()
        if task["due_date"] else None
    )
    del task["due_date"]
    return task


# Health check
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# Get all tasks
@app.get("/api/tasks")
def get_tasks():
    status = request.args.get("status")
    tag = request.args.get("tag")

    query = "SELECT * FROM tasks WHERE TRUE"
    params = []

    if status == "open":
        query += " AND done = FALSE"
    elif status == "done":
        query += " AND done = TRUE"

    if tag:
        query += " AND %s = ANY(tags)"
        params.append(tag)

    query += " ORDER BY ids"

    with get_db() as conn:
        tasks = conn.execute(query, params).fetchall()

    return jsonify([format_task(task) for task in tasks])


# Get one task
@app.get("/api/tasks/<int:id>")
def get_task(id):
    with get_db() as conn:
        task = conn.execute(
            "SELECT * FROM tasks WHERE id = %s",
            (id,)
        ).fetchone()

    if task is None:
        return jsonify({"error": "Task not found"}), 404

    return jsonify(format_task(task))


# Create a task
@app.post("/api/tasks")
def create_task():
    breakpoint()
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
            (title, description, done, due_date, tags)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                title.strip(),
                data.get("description"),
                data.get("done", False),
                data.get("dueDate"),
                data.get("tags", [])
            )
        ).fetchone()

    return jsonify(format_task(task)), 201


# Update a task
@app.patch("/api/tasks/<int:id>")
def update_task(id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    with get_db() as conn:
        task = conn.execute(
            "SELECT * FROM tasks WHERE id = %s",
            (id,)
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
            WHERE id = %s
            RETURNING *
            """,
            (
                title.strip(),
                data.get("description", task["description"]),
                data.get("done", task["done"]),
                data.get("dueDate", task["due_date"]),
                data.get("tags", task["tags"]),
                id
            )
        ).fetchone()

    return jsonify(format_task(updated_task))


# Delete a task
@app.delete("/api/tasks/<int:id>")
def delete_task(id):
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM tasks WHERE id = %s",
            (id,)
        )

        if result.rowcount == 0:
            return jsonify({"error": "Task not found"}), 404

    return "", 204

@app.errorhandler(psycopg.Error)
def handle_database_error(error):
    app.logger.error("Database error: %s", error)

    return jsonify({
        "error": "Database operation failed"
    }), 500

# Run Flask
if __name__ == "__main__":
    app.run(debug=True, port=5001)
