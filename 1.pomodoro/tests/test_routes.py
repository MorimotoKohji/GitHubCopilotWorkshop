import pytest
from app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app({
        "TESTING": True,
        "DATA_FILE": str(tmp_path / "progress.json"),
    })
    return app.test_client()


# ---- GET /api/progress ----

def test_get_progress_initial(client):
    res = client.get("/api/progress")
    assert res.status_code == 200
    data = res.get_json()
    assert data["completed_sessions"] == 0
    assert data["total_focus_minutes"] == 0


# ---- POST /api/progress/add ----

def test_add_progress_default_minutes(client):
    res = client.post("/api/progress/add", json={})
    assert res.status_code == 200
    data = res.get_json()
    assert data["completed_sessions"] == 1
    assert data["total_focus_minutes"] == 25


def test_add_progress_custom_minutes(client):
    res = client.post("/api/progress/add", json={"minutes": 5})
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_focus_minutes"] == 5


def test_add_progress_accumulates(client):
    client.post("/api/progress/add", json={"minutes": 25})
    res = client.post("/api/progress/add", json={"minutes": 25})
    data = res.get_json()
    assert data["completed_sessions"] == 2
    assert data["total_focus_minutes"] == 50


def test_get_progress_reflects_added_sessions(client):
    client.post("/api/progress/add", json={"minutes": 25})
    res = client.get("/api/progress")
    data = res.get_json()
    assert data["completed_sessions"] == 1


# ---- GET / ----

def test_index_returns_html(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"<html" in res.data.lower() or b"<!doctype" in res.data.lower()
