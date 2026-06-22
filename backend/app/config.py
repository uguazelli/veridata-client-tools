"""Runtime configuration, mirroring the Node app's env-driven base paths."""
import os
from pathlib import Path

# Repo root is one level up from backend/.
REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = REPO_ROOT / "public"
DATA_DIR = Path(os.environ.get("DATA_DIR", REPO_ROOT / "data"))


def normalize_base_path(value: str | None) -> str:
    """Mirror src/shared/basePath.js: ensure a single leading slash, no trailing.

    Returns "" for the root path so it can be concatenated directly.
    """
    if not value:
        return ""
    trimmed = "/" + value.strip().strip("/")
    return "" if trimmed == "/" else trimmed


class Settings:
    port = int(os.environ.get("PORT", "3000"))
    docs_base = normalize_base_path(os.environ.get("DOCS_BASE_PATH", "/docs"))
    mulesoft_base = normalize_base_path(os.environ.get("BASE_PATH", "/mulesoft-calculator"))
    api_readiness_base = normalize_base_path(os.environ.get("API_READINESS_BASE_PATH", "/api-readiness-assessment"))
    file_validator_base = normalize_base_path(os.environ.get("FILE_VALIDATOR_BASE_PATH", "/file-validator"))
    integration_audit_base = normalize_base_path(os.environ.get("INTEGRATION_AUDIT_PACK_BASE_PATH", "/integration-audit-pack"))
    odoo_base = normalize_base_path(os.environ.get("ODOO_COMPLEXITY_MAPPER_BASE_PATH", "/odoo-integration-complexity-mapper"))
    db_path = Path(os.environ.get("DB_PATH", DATA_DIR / "app.db"))


settings = Settings()
