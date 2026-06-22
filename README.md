# VeriDataPro Integration Tools

FastAPI (Python) backend serving VeriDataPro's lead-generation tools. The frontend
is no-framework vanilla JS/HTML served as static assets. Five tools:

- MuleSoft Cost & Utilization Risk Calculator
- API Readiness Assessment Tool
- Flat File Validation Tool
- Integration Audit Template Pack
- Odoo Integration Complexity Mapper

The MuleSoft, API readiness, and audit pack tools capture qualified lead details
and persist them to SQLite (upsert by email — one row per contact). The flat file
validator and Odoo complexity mapper run fully in the browser. A shared identity
modal captures a visitor once and records them in the `contacts` table.

## Run Locally

Requires [uv](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 3000
```

The app listens on these paths by default:

- `http://localhost:3000/docs` (tools directory)
- `http://localhost:3000/mulesoft-calculator`
- `http://localhost:3000/api-readiness-assessment`
- `http://localhost:3000/file-validator`
- `http://localhost:3000/integration-audit-pack`
- `http://localhost:3000/odoo-integration-complexity-mapper`

> Note: FastAPI's own interactive OpenAPI docs are served at `/docs` *by default*,
> but that path is used here for the tools directory page, which takes precedence.

Environment variables:

- `PORT`: server port, default `3000`
- `DB_PATH`: SQLite database file, default `data/app.db`
- `DOCS_BASE_PATH`: tools directory URL path, default `/docs`
- `BASE_PATH`: MuleSoft calculator URL path, default `/mulesoft-calculator`
- `API_READINESS_BASE_PATH`: default `/api-readiness-assessment`
- `FILE_VALIDATOR_BASE_PATH`: default `/file-validator`
- `INTEGRATION_AUDIT_PACK_BASE_PATH`: default `/integration-audit-pack`
- `ODOO_COMPLEXITY_MAPPER_BASE_PATH`: default `/odoo-integration-complexity-mapper`

## Docker Compose

```bash
docker compose up --build       # build + run
docker compose watch            # local dev with autoreload
```

Compose builds from `backend/Dockerfile`, syncs `backend/app` and `public/` into
the container, and persists the SQLite DB in the `data` volume.

## Endpoints

- `GET /docs`, `/mulesoft-calculator`, `/api-readiness-assessment`,
  `/file-validator`, `/integration-audit-pack`,
  `/odoo-integration-complexity-mapper`: tool frontends
- `POST /api/contact`: global identity capture (upsert by email)
- `POST /mulesoft-calculator/api/calculate`: validate, save lead, return assessment JSON
- `POST /api-readiness-assessment/api/assess`: validate, save lead, return readiness JSON
- `POST /integration-audit-pack/api/request`: validate, save lead, return document download URL
- `GET /health`: health check for deployment

## Project Structure

```text
public/                             # vanilla JS/HTML frontend (served as static assets)
  shared/                           # logo, shared CSS, identity module
  tools/<tool>/                     # one folder per tool frontend

backend/
  app/
    main.py                         # FastAPI app: routers + static/templated tool serving
    config.py                       # env-driven base paths
    db.py                           # SQLite schema + connection (upsert by email)
    tools/
      contact/                      # global identity endpoint
      mulesoft/                     # calculator, Pydantic schemas, store, router
      api_readiness/                # scoring, schemas, store, router
      integration_audit/            # schemas, store, router
  tests/
    golden/                         # frozen Node outputs (parity oracle)
    test_*_parity.py                # Python logic vs frozen Node fixtures
    test_*_api.py                   # API behaviour + upsert tests
```

## Tests

```bash
cd backend
uv run pytest
```

Parity tests compare the Python calculator/scoring against outputs frozen from the
original Node implementation (`tests/golden/`), so the ported logic stays faithful.

The MuleSoft calculator provides directional optimization signals only. It does not
provide official MuleSoft or Salesforce pricing.
