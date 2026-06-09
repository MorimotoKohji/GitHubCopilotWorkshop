import pytest
from progress import load_progress, add_session, save_progress, get_gamification, get_stats


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


# ---- get_gamification ----

def test_get_gamification_initial(tmp_path):
    f = str(tmp_path / "progress.json")
    data = get_gamification(f, today="2026-06-09")
    assert data["level"] == 1
    assert data["total_xp"] == 0
    assert data["xp_in_level"] == 0
    assert data["xp_per_level"] == 100
    assert data["streak"] == 0
    # All badges should be unearned
    assert all(not b["earned"] for b in data["badges"])


def test_get_gamification_xp_after_session(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    assert data["total_xp"] == 10
    assert data["xp_in_level"] == 10


def test_get_gamification_streak(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-08")
    add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    assert data["streak"] == 2


def test_get_gamification_streak_resets_on_gap(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-07")
    # 2026-06-08 にセッションなし
    add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    assert data["streak"] == 1


def test_get_gamification_level_up(tmp_path):
    f = str(tmp_path / "progress.json")
    # 10セッション完了でちょうど100XP (level 2)
    for _ in range(10):
        add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    assert data["level"] == 2
    assert data["xp_in_level"] == 0


def test_badge_first_session(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    earned_ids = [b["id"] for b in data["badges"] if b["earned"]]
    assert "first_session" in earned_ids


def test_badge_three_day_streak(tmp_path):
    f = str(tmp_path / "progress.json")
    for d in ["2026-06-07", "2026-06-08", "2026-06-09"]:
        add_session(f, minutes=25, today=d)
    data = get_gamification(f, today="2026-06-09")
    earned_ids = [b["id"] for b in data["badges"] if b["earned"]]
    assert "three_day_streak" in earned_ids


def test_badge_seven_day_streak(tmp_path):
    f = str(tmp_path / "progress.json")
    days = [f"2026-06-0{d}" for d in range(3, 10)]  # 2026-06-03 〜 2026-06-09
    for d in days:
        add_session(f, minutes=25, today=d)
    data = get_gamification(f, today="2026-06-09")
    earned_ids = [b["id"] for b in data["badges"] if b["earned"]]
    assert "seven_day_streak" in earned_ids


def test_badge_ten_in_week(tmp_path):
    f = str(tmp_path / "progress.json")
    for _ in range(10):
        add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    earned_ids = [b["id"] for b in data["badges"] if b["earned"]]
    assert "ten_in_week" in earned_ids


def test_badge_level_2(tmp_path):
    f = str(tmp_path / "progress.json")
    for _ in range(10):
        add_session(f, minutes=25, today="2026-06-09")
    data = get_gamification(f, today="2026-06-09")
    earned_ids = [b["id"] for b in data["badges"] if b["earned"]]
    assert "level_2" in earned_ids


def test_badge_metadata(tmp_path):
    f = str(tmp_path / "progress.json")
    data = get_gamification(f, today="2026-06-09")
    for badge in data["badges"]:
        assert "id" in badge
        assert "name" in badge
        assert "emoji" in badge
        assert "description" in badge
        assert "earned" in badge


# ---- get_stats ----

def test_get_stats_weekly_length(tmp_path):
    f = str(tmp_path / "progress.json")
    data = get_stats(f, days=7, today="2026-06-09")
    assert data["days"] == 7
    assert len(data["stats"]) == 7


def test_get_stats_monthly_length(tmp_path):
    f = str(tmp_path / "progress.json")
    data = get_stats(f, days=30, today="2026-06-09")
    assert data["days"] == 30
    assert len(data["stats"]) == 30


def test_get_stats_reflects_sessions(tmp_path):
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-09")
    add_session(f, minutes=25, today="2026-06-09")
    data = get_stats(f, days=7, today="2026-06-09")
    today_entry = data["stats"][-1]  # 最新日が末尾
    assert today_entry["date"] == "2026-06-09"
    assert today_entry["completed_sessions"] == 2
    assert today_entry["total_focus_minutes"] == 50


def test_get_stats_oldest_first(tmp_path):
    f = str(tmp_path / "progress.json")
    data = get_stats(f, days=7, today="2026-06-09")
    assert data["stats"][0]["date"] == "2026-06-03"
    assert data["stats"][-1]["date"] == "2026-06-09"


def test_get_stats_empty_days_are_zero(tmp_path):
    f = str(tmp_path / "progress.json")
    data = get_stats(f, days=7, today="2026-06-09")
    for entry in data["stats"]:
        assert entry["completed_sessions"] == 0
        assert entry["total_focus_minutes"] == 0


# ---- XP streak bonus ----

def test_streak_bonus_xp(tmp_path):
    """3日連続のストリーク中はセッションごとに +5 XP のボーナスが付く"""
    f = str(tmp_path / "progress.json")
    add_session(f, minutes=25, today="2026-06-07")  # streak 1, +10 XP = 10
    add_session(f, minutes=25, today="2026-06-08")  # streak 2, +10 XP = 20
    add_session(f, minutes=25, today="2026-06-09")  # streak 3, +15 XP = 35
    data = get_gamification(f, today="2026-06-09")
    assert data["total_xp"] == 35
