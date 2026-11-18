# Check authentication through API responses, rather than internal functions.

def test_tasks_require_login(client):
    # No authorization header should stop the request before tasks are returned.
    response = client.get("/api/tasks")

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authentication required"

# Registration should return public account details without exposing credentials.
def test_register_creates_user(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "learner@example.com",
            "password": "Practice-password-123!"
        }
    )

    assert response.status_code == 201

    user = response.get_json()
    assert isinstance(user["id"], int)
    assert user["email"] == "learner@example.com"
    # Neither plaintext passwords nor stored hashes belong in the response.
    assert "password" not in user
    assert "password_hash" not in user

# A successful login must produce a token usable by a protected endpoint.
def test_login_returns_valid_token(client):
    # This test creates its own account and does not depend on earlier tests.
    credentials = {
        "email": "learner@example.com",
        "password": "Practice-password-123!"
    }

    registered = client.post(
        "/api/auth/register",
        json=credentials
    )
    assert registered.status_code == 201

    response = client.post(
        "/api/auth/login",
        json=credentials
    )
    assert response.status_code == 200

    token = response.get_json()["token"]
    assert isinstance(token, str)
    assert token

    # Check the token actually identifies the registered user.
    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert me.status_code == 200
    assert me.get_json()["id"] == registered.get_json()["id"]
    assert me.get_json()["email"] == credentials["email"]

# Incorrect credentials must return 401 without issuing a token.
def test_login_rejects_wrong_password(client):
    registered = client.post(
        "/api/auth/register",
        json={
            "email": "learner@example.com",
            "password": "Practice-password-123!"
        }
    )
    assert registered.status_code == 201

    response = client.post(
        "/api/auth/login",
        json={
            "email": "learner@example.com",
            "password": "Incorrect-password!"
        }
    )

    assert response.status_code == 401

    data = response.get_json()
    # A generic message avoids revealing whether the email or password was wrong.
    assert data["error"] == "Invalid email or password"
    assert "token" not in data