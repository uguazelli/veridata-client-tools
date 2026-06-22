"""Persist an integration-audit-pack lead, upserting by email."""
from datetime import datetime, timezone

from ...db import get_connection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_lead(data: dict, download_file: str, user_agent: str | None) -> str:
    now = _now()
    email = data["email"]
    row = {
        "email": email,
        "created_at": now,
        "updated_at": now,
        "language": data.get("language"),
        "full_name": data.get("fullName"),
        "company": data.get("company"),
        "role": data.get("role"),
        "website": data.get("website"),
        "company_size": data.get("companySize"),
        "timeline": data.get("timeline"),
        "primary_challenge": data.get("primaryChallenge"),
        "download_file": download_file,
        "user_agent": user_agent or "",
    }
    columns = ", ".join(row.keys())
    placeholders = ", ".join(f":{key}" for key in row)
    updates = ", ".join(f"{key} = excluded.{key}" for key in row if key not in ("email", "created_at"))

    with get_connection() as conn:
        existed = conn.execute("SELECT 1 FROM integration_audit_leads WHERE email = ?", (email,)).fetchone()
        conn.execute(
            f"INSERT INTO integration_audit_leads ({columns}) VALUES ({placeholders}) "
            f"ON CONFLICT(email) DO UPDATE SET {updates}",
            row,
        )
    return "updated" if existed else "created"
