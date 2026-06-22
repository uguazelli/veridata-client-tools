from app import db

VALID = {
    "language": "en",
    "fullName": "Sam Carter",
    "email": "sam@example.com",
    "company": "Example Co",
    "role": "Operations",
    "website": "example.com",
    "companySize": "11-50",
    "timeline": "now",
    "primaryChallenge": "manual-work",
}


def test_valid_request_returns_download_and_stores_row(client):
    res = client.post("/integration-audit-pack/api/request", json=VALID)
    assert res.status_code == 200
    download = res.json()["download"]
    assert download["fileName"] == "Veridata_Integration_Audit_Pack.docx"
    assert download["url"].endswith("/tools/integration-audit-pack/Veridata_Integration_Audit_Pack.docx")

    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM integration_audit_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["full_name"] == "Sam Carter"


def test_returning_client_upserts(client):
    client.post("/integration-audit-pack/api/request", json=VALID)
    client.post("/integration-audit-pack/api/request", json={**VALID, "role": "CTO"})

    with db.get_connection() as conn:
        rows = conn.execute("SELECT role FROM integration_audit_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["role"] == "CTO"


def test_missing_company_size_returns_400(client):
    res = client.post("/integration-audit-pack/api/request", json={**VALID, "companySize": ""})
    assert res.status_code == 400
    assert "companySize" in res.json()["fields"]


def test_index_pages_render_with_base_path(client):
    # Every tool's index serves and injects its base path (no leftover token).
    for path in ["/mulesoft-calculator/", "/api-readiness-assessment/", "/file-validator/",
                 "/integration-audit-pack/", "/odoo-integration-complexity-mapper/", "/docs/"]:
        res = client.get(path)
        assert res.status_code == 200, path
        assert "__BASE_PATH__" not in res.text, path
