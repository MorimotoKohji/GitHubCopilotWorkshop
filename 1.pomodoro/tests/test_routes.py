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


def test_add_progress_invalid_minutes_string(client):
    res = client.post("/api/progress/add", json={"minutes": "abc"})
    assert res.status_code == 400


def test_add_progress_invalid_minutes_zero(client):
    res = client.post("/api/progress/add", json={"minutes": 0})
    assert res.status_code == 400


# ---- GET / ----

def test_index_returns_html(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"<html" in res.data.lower() or b"<!doctype" in res.data.lower()


# ---- GET /api/gamification ----

def test_get_gamification_initial(client):
    res = client.get("/api/gamification")
    assert res.status_code == 200
    data = res.get_json()
    assert data["level"] == 1
    assert data["total_xp"] == 0
    assert data["xp_in_level"] == 0
    assert data["xp_per_level"] == 100
    assert data["streak"] == 0
    assert isinstance(data["badges"], list)
    assert len(data["badges"]) > 0
    assert all(not b["earned"] for b in data["badges"])


def test_get_gamification_after_session(client):
    client.post("/api/progress/add", json={"minutes": 25})
    res = client.get("/api/gamification")
    assert res.status_code == 200
    data = res.get_json()
    assert data["total_xp"] == 10
    first_session_badge = next(b for b in data["badges"] if b["id"] == "first_session")
    assert first_session_badge["earned"] is True


def test_get_gamification_badge_fields(client):
    res = client.get("/api/gamification")
    data = res.get_json()
    for badge in data["badges"]:
        assert "id" in badge
        assert "name" in badge
        assert "emoji" in badge
        assert "description" in badge
        assert "earned" in badge


# ---- GET /api/stats ----

def test_get_stats_weekly(client):
    res = client.get("/api/stats?days=7")
    assert res.status_code == 200
    data = res.get_json()
    assert data["days"] == 7
    assert len(data["stats"]) == 7


def test_get_stats_monthly(client):
    res = client.get("/api/stats?days=30")
    assert res.status_code == 200
    data = res.get_json()
    assert data["days"] == 30
    assert len(data["stats"]) == 30


def test_get_stats_default(client):
    res = client.get("/api/stats")
    assert res.status_code == 200
    data = res.get_json()
    assert data["days"] == 7


def test_get_stats_invalid_days(client):
    res = client.get("/api/stats?days=abc")
    assert res.status_code == 400


def test_get_stats_reflects_sessions(client):
    client.post("/api/progress/add", json={"minutes": 25})
    client.post("/api/progress/add", json={"minutes": 25})
    res = client.get("/api/stats?days=7")
    data = res.get_json()
    today_entry = data["stats"][-1]
    assert today_entry["completed_sessions"] == 2
    assert today_entry["total_focus_minutes"] == 50


def test_get_stats_entry_fields(client):
    res = client.get("/api/stats?days=7")
    data = res.get_json()
    for entry in data["stats"]:
        assert "date" in entry
        assert "completed_sessions" in entry
        assert "total_focus_minutes" in entry
