# Exercise task behavior through authenticated API requests and saved results.

def test_create_task(client):
    # Arrange: create a user and obtain a token for the task owner.
    credentials = {
        "email": "learner@example.com",
        "password": "Practice-password-123!"
    }

    registered = client.post(
        "/api/auth/register",
        json=credentials
    )
    assert registered.status_code == 201
    user_id = registered.get_json()["id"]

    login = client.post("/api/auth/login", json=credentials)
    assert login.status_code == 200

    headers = {
        "Authorization": f"Bearer {login.get_json()['token']}"
    }

    # Act: create a task through the API.
    response = client.post(
        "/api/tasks",
        headers=headers,
        json={"title": "Learn API testing", "tags": ["learning"]}
    )

    assert response.status_code == 201

    task = response.get_json()
    assert task["title"] == "Learn API testing"
    assert task["done"] is False
    assert task["tags"] == ["learning"]
    # The server assigns ownership from the authenticated user.
    assert task["userId"] == user_id

    # Reading the task back checks it was saved, not just returned by POST.
    saved = client.get(f"/api/tasks/{task['id']}", headers=headers)

    assert saved.status_code == 200
    assert saved.get_json() == task

def test_create_task_requires_title(client, auth_headers):
    # A valid token isolates title validation from authentication failures.
    response = client.post(
        "/api/tasks",
        headers=auth_headers,
        json={"description": "A task without a title"}
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Title must be 1-200 characters"

    # Rejected creation must not leave a task behind.
    tasks = client.get("/api/tasks", headers=auth_headers)
    assert tasks.status_code == 200
    assert tasks.get_json() == []

def test_get_missing_task(client, auth_headers):
    # Use an ID that is absent from the test database.
    response = client.get(
        "/api/tasks/2147483647",
        headers=auth_headers
    )

    assert response.status_code == 404
    assert response.get_json()["error"] == "Task not found"

def test_update_task(client, auth_headers):
    # Create the starting task inside this test so it can run independently.
    created = client.post(
        "/api/tasks",
        headers=auth_headers,
        json={
            "title": "Original task",
            "tags": ["learning"]
        }
    )
    assert created.status_code == 201
    original = created.get_json()

    # PATCH changes only the supplied fields.
    response = client.patch(
        f"/api/tasks/{original['id']}",
        headers=auth_headers,
        json={
            "title": "Updated task",
            "done": True
        }
    )

    assert response.status_code == 200

    updated = response.get_json()
    assert updated["id"] == original["id"]
    assert updated["title"] == "Updated task"
    assert updated["done"] is True
    # Unchanged fields and ownership must survive the update.
    assert updated["tags"] == ["learning"]
    assert updated["userId"] == original["userId"]

    saved = client.get(
        f"/api/tasks/{original['id']}",
        headers=auth_headers
    )

    assert saved.status_code == 200
    # Confirm the edited values are saved in the database.
    assert saved.get_json() == updated

def test_delete_task(client, auth_headers):
    # Create a disposable task, then remove it using its returned ID.
    created = client.post(
        "/api/tasks",
        headers=auth_headers,
        json={"title": "Temporary task"}
    )
    assert created.status_code == 201
    task_id = created.get_json()["id"]

    deleted = client.delete(
        f"/api/tasks/{task_id}",
        headers=auth_headers
    )

    assert deleted.status_code == 204
    # A 204 response has no body, including no JSON object.
    assert deleted.data == b""

    # A successful status alone is insufficient: the task must be gone.
    missing = client.get(
        f"/api/tasks/{task_id}",
        headers=auth_headers
    )
    assert missing.status_code == 404

    tasks = client.get("/api/tasks", headers=auth_headers)
    assert tasks.status_code == 200
    assert tasks.get_json() == []

def test_users_cannot_access_another_users_task(client, auth_headers):
    # auth_headers belongs to user A.
    created = client.post(
        "/api/tasks",
        headers=auth_headers,
        json={"title": "User A private task"}
    )
    assert created.status_code == 201
    original = created.get_json()
    task_url = f"/api/tasks/{original['id']}"

    credentials = {
        "email": "other@example.com",
        "password": "Another-practice-password!"
    }

    # User B gets a separate identity and token.
    registered = client.post("/api/auth/register", json=credentials)
    assert registered.status_code == 201

    login = client.post("/api/auth/login", json=credentials)
    assert login.status_code == 200

    other_headers = {
        "Authorization": f"Bearer {login.get_json()['token']}"
    }

    # Listing must hide user A's task from user B.
    listed = client.get("/api/tasks", headers=other_headers)
    assert listed.status_code == 200
    assert listed.get_json() == []

    # Knowing another user's task ID must not grant read or write access.
    # Returning 404 also avoids disclosing whether that private task exists.
    read = client.get(task_url, headers=other_headers)
    assert read.status_code == 404

    edited = client.patch(
        task_url,
        headers=other_headers,
        json={"title": "Unauthorized change"}
    )
    assert edited.status_code == 404

    deleted = client.delete(task_url, headers=other_headers)
    assert deleted.status_code == 404

    # The owner's task must still exist and remain unchanged.
    saved = client.get(task_url, headers=auth_headers)
    assert saved.status_code == 200
    assert saved.get_json() == original