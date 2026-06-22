"""Global contact store. Upsert by email; preserve first_seen across updates."""
from datetime import datetime, timezone

from ...db import get_connection


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_contact(contact: dict, user_agent: str | None) -> str:
    """Insert or refresh a contact by email. Returns 'created' or 'updated'.

    Unlike the old CSV version, first_seen is genuinely preserved on update.
    """
    now = _now()
    email = contact["email"]
    with get_connection() as conn:
        existed = conn.execute("SELECT 1 FROM contacts WHERE email = ?", (email,)).fetchone()
        conn.execute(
            """
            INSERT INTO contacts (email, first_seen, last_seen, client_id, language, full_name, company, source, user_agent)
            VALUES (:email, :now, :now, :client_id, :language, :full_name, :company, :source, :user_agent)
            ON CONFLICT(email) DO UPDATE SET
                last_seen = excluded.last_seen,
                client_id = excluded.client_id,
                language  = excluded.language,
                full_name = excluded.full_name,
                company   = excluded.company,
                source    = excluded.source,
                user_agent = excluded.user_agent
            """,
            {
                "email": email,
                "now": now,
                "client_id": contact.get("clientId") or "",
                "language": contact.get("language"),
                "full_name": contact.get("fullName"),
                "company": contact.get("company"),
                "source": contact.get("source") or "",
                "user_agent": user_agent or "",
            },
        )
    return "updated" if existed else "created"
