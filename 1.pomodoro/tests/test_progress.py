import pytest
from progress import load_progress, add_session, save_progress


# ---- load_progress ----

def test_load_progress_returns_empty_when_no_file(tmp_path):
    f = str(tmp_path / "progress.json")
    data = load_progress(f, today="2026-06-09")
    assert data == {"date": "2026-06-09", "completed_sessions": 0, "total_focus_minutes": 0}


def test_load_progress_returns_existing_data(tmp_path):
    f = str(tmp_path / "progress.json")
    saved = {"date": "2026-06-09", "completed_sessions": 3, "total_focus_minutes": 75}
    save_progress(f, saved)
    data = load_progress(f, today="2026-06-09")
    assert data["completed_sessions"] == 3
    assert data["total_focus_minutes"] == 75


def test_load_progress_resets_on_new_day(tmp_path):
    f = str(tmp_path / "progress.json")
    # 昨日のデータを保存
    save_progress(f, {"date": "2026-06-08", "completed_sessions": 5, "total_focus_minutes": 125})
    # 今日の日付で読み込むとリセットされる
    data = load_progress(f, today="2026-06-09")
    assert data["completed_sessions"] == 0
    assert data["total_focus_minutes"] == 0
    assert data["date"] == "2026-06-09"


# ---- add_session ----

def test_add_session_increments_count(tmp_path):
    f = str(tmp_path / "progress.json")
    result = add_session(f, minutes=25, today="2026-06-09")
    assert result["completed_sessions"] == 1
    assert result["total_focus_minutes"] == 25


def test_add_session_accumulates(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-09")
    result = add_session(f, minutes=25, today="2026-06-09")
    assert result["completed_sessions"] == 2
    assert result["total_focus_minutes"] == 50


def test_add_session_persists_to_file(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-09")
    # ファイルから再読み込みして永続化されているか確認
    data = load_progress(f, today="2026-06-09")
    assert data["completed_sessions"] == 1


def test_add_session_resets_on_new_day(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-08")
    result = add_session(f, minutes=25, today="2026-06-09")
    assert result["completed_sessions"] == 1  # 翌日はリセット


def test_add_session_custom_minutes(tmp_path):
    f = str(tmp_path / "progress.json")
    result = add_session(f, minutes=5, today="2026-06-09")  # カスタム分数
    assert result["total_focus_minutes"] == 5
