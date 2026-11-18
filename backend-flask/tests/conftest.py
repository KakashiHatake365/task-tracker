# Pytest automatically loads these shared fixtures from conftest.py.
from contextlib import contextmanager
from pathlib import Path

import psycopg
import pytest
from dotenv import dotenv_values
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row

import app as app_module


@pytest.fixture
def client(monkeypatch):
    # Locate the backend .env independently of the terminal working directory.
    settings = dotenv_values(
        Path(__file__).resolve().parents[1] / ".env"
    )
    test_url = settings.get("TEST_DATABASE_URL")

    if not test_url:
        pytest.fail("TEST_DATABASE_URL is missing")

    # Check database names before allowing tests to make any changes.
    test_config = conninfo_to_dict(test_url)
    app_config = conninfo_to_dict(settings.get("DATABASE_URL", ""))

    if (
        test_config.get("dbname") != "task_tracker_test"
        or test_config.get("dbname") == app_config.get("dbname")
    ):
        pytest.fail("Tests must use the separate task_tracker_test database")

    # Dictionary rows match the format used by the real Flask database driver.
    with psycopg.connect(test_url, row_factory=dict_row) as connection:
        # Also verify the actual database reported by PostgreSQL.
        database = connection.execute(
            "SELECT current_database() AS name"
        ).fetchone()

        if database["name"] != "task_tracker_test":
            pytest.fail("Connected to the wrong database")

        # Roll back test row changes, even when an assertion fails.
        # PostgreSQL sequence IDs can still advance after a rollback.
        with connection.transaction(force_rollback=True):

            @contextmanager
            def test_db():
                # Match get_db()'s context-manager interface using one connection.
                # Savepoints let a failed SQL operation roll back independently.
                with connection.transaction():
                    yield connection

            # Route all API database access through the isolated test connection.
            # Pytest restores these patched settings after the test finishes.
            monkeypatch.setattr(app_module, "get_db", test_db)
            # Test tokens use a separate signing key from real login sessions.
            monkeypatch.setattr(
                app_module,
                "JWT_SECRET_KEY",
                "test-only-signing-key-never-use-for-real-accounts"
            )
            monkeypatch.setitem(app_module.app.config, "TESTING", True)

            # Call Flask directly, without starting a server or making HTTP calls.
            with app_module.app.test_client() as test_client:
                # Yield gives the client to the test; cleanup runs when it returns.
                yield test_client

@pytest.fixture
def auth_headers(client):
    # Create and log in a fresh user for tests that need authentication.
    # Depending on client keeps this user inside the same rollback transaction.
    credentials = {
        "email": "tester@example.com",
        "password": "Practice-password-123!"
    }

    registered = client.post(
        "/api/auth/register",
        json=credentials
    )
    assert registered.status_code == 201

    login = client.post("/api/auth/login", json=credentials)
    assert login.status_code == 200

    # Protected routes expect the token in the Bearer authorization header.
    return {
        "Authorization": f"Bearer {login.get_json()['token']}"
    }