import json
import os
from datetime import date, timedelta

XP_PER_SESSION = 10
XP_PER_LEVEL = 100

ALL_BADGES = [
    {
        "id": "first_session",
        "name": "初回達成",
        "emoji": "🎯",
        "description": "初めてポモドーロを完了",
    },
    {
        "id": "three_day_streak",
        "name": "3日連続",
        "emoji": "🔥",
        "description": "3日連続でポモドーロを完了",
    },
    {
        "id": "seven_day_streak",
        "name": "7日連続",
        "emoji": "⚡",
        "description": "7日連続でポモドーロを完了",
    },
    {
        "id": "ten_in_week",
        "name": "週10達成",
        "emoji": "🏆",
        "description": "1週間で10回ポモドーロを完了",
    },
    {
        "id": "level_2",
        "name": "Lv.2到達",
        "emoji": "⭐",
        "description": "レベル2に到達",
    },
]

_BADGE_CONDITIONS: dict = {
    "first_session":    lambda c: c["total_sessions"] >= 1,
    "three_day_streak": lambda c: c["streak"] >= 3,
    "seven_day_streak": lambda c: c["streak"] >= 7,
    "ten_in_week":      lambda c: c["weekly_sessions"] >= 10,
    "level_2":          lambda c: c["level"] >= 2,
}


def _today_str() -> str:
    return str(date.today())


def _load_raw(data_file: str) -> dict:
    """Load the raw data file (multi-day format)."""
    if os.path.exists(data_file):
        try:
            with open(data_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "history" in data:
                return data
        except (OSError, json.JSONDecodeError, ValueError):
            pass
    return {"history": {}, "total_xp": 0, "badges": []}


def _save_raw(data_file: str, raw: dict) -> None:
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False)


def _calc_streak(history: dict, today: str) -> int:
    """Count consecutive days with at least one session, ending on today."""
    streak = 0
    current = date.fromisoformat(today)
    while True:
        if history.get(str(current), {}).get("completed_sessions", 0) > 0:
            streak += 1
            current -= timedelta(days=1)
        else:
            break
    return streak


def _calc_weekly_sessions(history: dict, today: str) -> int:
    """Total sessions in the last 7 days including today."""
    today_date = date.fromisoformat(today)
    return sum(
        history.get(str(today_date - timedelta(days=i)), {}).get("completed_sessions", 0)
        for i in range(7)
    )


def _calc_total_sessions(history: dict) -> int:
    return sum(v.get("completed_sessions", 0) for v in history.values())


def _check_badges(raw: dict, today: str) -> list:
    """Return the updated list of earned badge IDs."""
    history = raw["history"]
    total_xp = raw.get("total_xp", 0)
    context = {
        "streak": _calc_streak(history, today),
        "weekly_sessions": _calc_weekly_sessions(history, today),
        "total_sessions": _calc_total_sessions(history),
        "level": total_xp // XP_PER_LEVEL + 1,
    }
    earned = set(raw.get("badges", []))
    for badge_id, condition in _BADGE_CONDITIONS.items():
        if badge_id not in earned and condition(context):
            earned.add(badge_id)
    return list(earned)


def load_progress(data_file: str, today: str | None = None) -> dict:
    """Return today's progress in the original format (backward-compatible)."""
    today = today or _today_str()
    raw = _load_raw(data_file)
    day_data = raw["history"].get(today, {})
    return {
        "date": today,
        "completed_sessions": day_data.get("completed_sessions", 0),
        "total_focus_minutes": day_data.get("total_focus_minutes", 0),
    }


def save_progress(data_file: str, data: dict) -> None:
    """Save a daily progress record (accepts legacy dict format)."""
    today = data.get("date", _today_str())
    raw = _load_raw(data_file)
    raw["history"][today] = {
        "completed_sessions": data.get("completed_sessions", 0),
        "total_focus_minutes": data.get("total_focus_minutes", 0),
    }
    _save_raw(data_file, raw)


def add_session(data_file: str, minutes: int = 25, today: str | None = None) -> dict:
    """Record a completed session and update XP and badges."""
    today = today or _today_str()
    raw = _load_raw(data_file)
    history = raw["history"]

    if today not in history:
        history[today] = {"completed_sessions": 0, "total_focus_minutes": 0}
    history[today]["completed_sessions"] += 1
    history[today]["total_focus_minutes"] += minutes

    streak = _calc_streak(history, today)
    xp_gained = XP_PER_SESSION + (5 if streak >= 3 else 0)
    raw["total_xp"] = raw.get("total_xp", 0) + xp_gained
    raw["badges"] = _check_badges(raw, today)

    _save_raw(data_file, raw)

    return {
        "date": today,
        "completed_sessions": history[today]["completed_sessions"],
        "total_focus_minutes": history[today]["total_focus_minutes"],
    }


def get_gamification(data_file: str, today: str | None = None) -> dict:
    """Return XP, level, streak, and badge information."""
    today = today or _today_str()
    raw = _load_raw(data_file)
    history = raw["history"]
    total_xp = raw.get("total_xp", 0)
    level = total_xp // XP_PER_LEVEL + 1
    xp_in_level = total_xp % XP_PER_LEVEL
    streak = _calc_streak(history, today)

    earned_ids = set(raw.get("badges", []))
    badges_info = [
        {
            "id": b["id"],
            "name": b["name"],
            "emoji": b["emoji"],
            "description": b["description"],
            "earned": b["id"] in earned_ids,
        }
        for b in ALL_BADGES
    ]

    return {
        "total_xp": total_xp,
        "level": level,
        "xp_in_level": xp_in_level,
        "xp_per_level": XP_PER_LEVEL,
        "streak": streak,
        "badges": badges_info,
    }


def get_stats(data_file: str, days: int = 7, today: str | None = None) -> dict:
    """Return daily stats for the last `days` days (oldest first)."""
    today = today or _today_str()
    today_date = date.fromisoformat(today)
    raw = _load_raw(data_file)
    history = raw["history"]

    result = []
    for i in range(days - 1, -1, -1):
        day_str = str(today_date - timedelta(days=i))
        day_data = history.get(day_str, {})
        result.append({
            "date": day_str,
            "completed_sessions": day_data.get("completed_sessions", 0),
            "total_focus_minutes": day_data.get("total_focus_minutes", 0),
        })

    return {"stats": result, "days": days}
