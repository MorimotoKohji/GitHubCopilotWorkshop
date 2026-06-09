import json
import os
from datetime import date


def _today_str():
    return str(date.today())


def load_progress(data_file: str, today: str | None = None) -> dict:
    today = today or _today_str()
    if os.path.exists(data_file):
        try:
            with open(data_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError, ValueError):
            data = None
        if isinstance(data, dict) and data.get("date") == today:
            return data
    return {"date": today, "completed_sessions": 0, "total_focus_minutes": 0}


def save_progress(data_file: str, data: dict) -> None:
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def add_session(data_file: str, minutes: int = 25, today: str | None = None) -> dict:
    today = today or _today_str()
    data = load_progress(data_file, today)
    data["completed_sessions"] += 1
    data["total_focus_minutes"] += minutes
    save_progress(data_file, data)
    return data
