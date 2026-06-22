"""SQLite storage. Replaces the CSV stores; upsert-by-email is native here."""
import sqlite3
from pathlib import Path

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    email       TEXT PRIMARY KEY,
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL,
    client_id   TEXT,
    language    TEXT,
    full_name   TEXT,
    company     TEXT,
    source      TEXT,
    user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS mulesoft_leads (
    email                   TEXT PRIMARY KEY,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    language                TEXT,
    full_name               TEXT,
    company                 TEXT,
    deployment_model        TEXT,
    commercial_model        TEXT,
    production_cores        REAL,
    sandbox_cores           REAL,
    running_applications    INTEGER,
    utilization_pct         REAL,
    managed_apis            INTEGER,
    addons                  TEXT,
    renewal_timeline        TEXT,
    risk_level              TEXT,
    risk_score              INTEGER,
    estimated_waste_percent INTEGER,
    recommendations         TEXT,
    client_id               TEXT,
    user_agent              TEXT
);

CREATE TABLE IF NOT EXISTS api_readiness_leads (
    email           TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    language        TEXT,
    full_name       TEXT,
    company         TEXT,
    website         TEXT,
    company_size    TEXT,
    timeline        TEXT,
    score           INTEGER,
    status          TEXT,
    category_scores TEXT,
    pain_points     TEXT,
    recommendation  TEXT,
    answers_json    TEXT,
    user_agent      TEXT
);

CREATE TABLE IF NOT EXISTS integration_audit_leads (
    email             TEXT PRIMARY KEY,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    language          TEXT,
    full_name         TEXT,
    company           TEXT,
    role              TEXT,
    website           TEXT,
    company_size      TEXT,
    timeline          TEXT,
    primary_challenge TEXT,
    download_file     TEXT,
    user_agent        TEXT
);
"""


def _db_path() -> Path:
    return settings.db_path


def get_connection() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA)
