"""Persist an api-readiness lead, upserting by email."""
import json
from datetime import datetime, timezone

from ...db import get_connection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_lead(submission: dict, result: dict, user_agent: str | None) -> str:
    now = _now()
    lead = submission["lead"]
    email = lead["email"]
    row = {
        "email": email,
        "created_at": now,
        "updated_at": now,
        "language": submission.get("language"),
        "full_name": lead.get("fullName"),
        "company": lead.get("company"),
        "website": lead.get("website"),
        "company_size": lead.get("companySize"),
        "timeline": lead.get("timeline"),
        "score": result["score"],
        "status": result["status"],
        "category_scores": json.dumps(result["categoryScores"]),
        "pain_points": " | ".join(result["painPoints"]),
        "recommendation": result["recommendation"],
        "answers_json": json.dumps(submission.get("answers")),
        "user_agent": user_agent or "",
    }
    columns = ", ".join(row.keys())
    placeholders = ", ".join(f":{key}" for key in row)
    updates = ", ".join(f"{key} = excluded.{key}" for key in row if key not in ("email", "created_at"))

    with get_connection() as conn:
        existed = conn.execute("SELECT 1 FROM api_readiness_leads WHERE email = ?", (email,)).fetchone()
        conn.execute(
            f"INSERT INTO api_readiness_leads ({columns}) VALUES ({placeholders}) "
            f"ON CONFLICT(email) DO UPDATE SET {updates}",
            row,
        )
    return "updated" if existed else "created"
