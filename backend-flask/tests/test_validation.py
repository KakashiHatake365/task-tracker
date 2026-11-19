import pytest


@pytest.mark.parametrize("method", ["post", "patch"])
@pytest.mark.parametrize("invalid_fields", [
    {"done": None},
    {"done": 123},
    {"done": "false"},
    {"description": {}},
    {"tags": None},
    {"tags": "work"},
    {"tags": [1]},
    {"dueDate": "2026-99-99"},
    {"dueDate": "2026-02-30"},
    {"dueDate": "20261201"},
    {"dueDate": 123},
])
def test_invalid_task_fields_return_400(client, auth_headers, method, invalid_fields):
    original = None
    path = "/api/tasks"
    if method == "patch":
        created = client.post(path, headers=auth_headers, json={"title": "Original"})
        assert created.status_code == 201
        original = created.get_json()
        path += f"/{original['id']}"

    response = getattr(client, method)(
        path, headers=auth_headers, json={"title": "Rejected", **invalid_fields}
    )
    assert response.status_code == 400
    assert isinstance(response.get_json()["error"], str)

    if original:
        assert client.get(path, headers=auth_headers).get_json() == original
    else:
        assert client.get(path, headers=auth_headers).get_json() == []


def test_nullable_optional_fields_and_leap_date_are_valid(client, auth_headers):
    response = client.post("/api/tasks", headers=auth_headers, json={
        "title": " Valid task ", "description": None, "dueDate": "2028-02-29",
        "done": False, "tags": [],
    })
    assert response.status_code == 201
    task = response.get_json()
    assert task["title"] == "Valid task"
    assert task["dueDate"] == "2028-02-29"
    assert task["done"] is False

    updated = client.patch(f"/api/tasks/{task['id']}", headers=auth_headers,
                           json={"dueDate": None, "description": None})
    assert updated.status_code == 200
    assert updated.get_json()["dueDate"] is None


@pytest.mark.parametrize("method,path", [
    ("get", "/api/tasks/not-an-id"),
    ("get", "/unknown-route"),
    ("post", "/api/health"),
])
def test_framework_errors_are_json(client, auth_headers, method, path):
    response = getattr(client, method)(path, headers=auth_headers)
    assert response.status_code == (405 if method == "post" else 404)
    assert response.is_json
    assert isinstance(response.get_json()["error"], str)
    if response.status_code == 405:
        assert "GET" in response.headers["Allow"]


def test_malformed_json_is_a_client_error(client, auth_headers):
    response = client.post("/api/tasks", headers=auth_headers,
                           data='{"title":', content_type="application/json")
    assert response.status_code == 400
    assert response.is_json


@pytest.mark.parametrize("method,path", [
    ("get", "/api/tasks"), ("get", "/api/tasks/1"),
    ("post", "/api/tasks"), ("patch", "/api/tasks/1"),
    ("delete", "/api/tasks/1"),
])
def test_every_task_route_requires_a_token(client, method, path):
    response = getattr(client, method)(path, json={"title": "Blocked"})
    assert response.status_code == 401


def test_client_cannot_assign_or_change_task_owner(client, auth_headers):
    me = client.get("/api/auth/me", headers=auth_headers).get_json()
    created = client.post("/api/tasks", headers=auth_headers, json={
        "title": "Owned task", "userId": me["id"] + 1, "user_id": me["id"] + 1,
    })
    assert created.status_code == 201
    task = created.get_json()
    assert task["userId"] == me["id"]

    updated = client.patch(f"/api/tasks/{task['id']}", headers=auth_headers,
                           json={"userId": me["id"] + 1, "user_id": me["id"] + 1})
    assert updated.status_code == 200
    assert updated.get_json()["userId"] == me["id"]
