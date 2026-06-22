"""Persist a mulesoft lead, upserting by email (native SQLite ON CONFLICT)."""
from datetime import datetime, timezone

from ...db import get_connection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_lead(submission: dict, result: dict, user_agent: str | None) -> str:
    """Insert or update the lead for this email. Returns 'created' or 'updated'."""
    now = _now()
    email = submission["email"]
    row = {
        "email": email,
        "created_at": now,
        "updated_at": now,
        "language": submission.get("language"),
        "full_name": submission.get("fullName"),
        "company": submission.get("company"),
        "deployment_model": submission.get("deploymentModel"),
        "commercial_model": submission.get("commercialModel"),
        "production_cores": submission.get("productionCores"),
        "sandbox_cores": submission.get("sandboxCores"),
        "running_applications": submission.get("runningApplications"),
        "utilization_pct": submission.get("utilizationPct"),
        "managed_apis": submission.get("managedApis"),
        "addons": "|".join(submission.get("addons") or []),
        "renewal_timeline": submission.get("renewalTimeline"),
        "risk_level": result["risk"]["level"],
        "risk_score": result["risk"]["score"],
        "estimated_waste_percent": result["waste"]["estimatedPercent"],
        "recommendations": " | ".join(result["recommendations"]),
        "client_id": submission.get("clientId") or "",
        "user_agent": user_agent or "",
    }

    columns = ", ".join(row.keys())
    placeholders = ", ".join(f":{key}" for key in row)
    # On conflict keep the original created_at; refresh everything else.
    updates = ", ".join(f"{key} = excluded.{key}" for key in row if key not in ("email", "created_at"))

    with get_connection() as conn:
        existed = conn.execute("SELECT 1 FROM mulesoft_leads WHERE email = ?", (email,)).fetchone()
        conn.execute(
            f"INSERT INTO mulesoft_leads ({columns}) VALUES ({placeholders}) "
            f"ON CONFLICT(email) DO UPDATE SET {updates}",
            row,
        )
    return "updated" if existed else "created"
