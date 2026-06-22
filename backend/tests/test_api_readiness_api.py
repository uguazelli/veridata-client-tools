from app import db

VALID = {
    "language": "en",
    "lead": {
        "fullName": "Jordan Lee",
        "email": "jordan@example.com",
        "company": "Example Systems",
        "website": "example.com",
        "companySize": "51-200",
        "timeline": "1-3",
    },
    "answers": {
        "systemsCount": "8-12",
        "systemTypes": ["odoo", "crm", "ecommerce", "finance"],
        "manualCopyFrequency": "daily",
        "spreadsheetDependency": "heavy",
        "apiAvailability": "unknown",
        "sourceOfTruth": "unclear",
        "dataQuality": "inconsistent",
        "reportingConsistency": "manualReports",
        "integrationReliability": "oftenBreak",
        "systemOwnership": "unclear",
        "upcomingMigration": "plannedDataConcerns",
        "biggestProblem": "Too much manual CSV work between systems.",
    },
}


def test_valid_assessment_returns_result_and_stores_one_row(client):
    res = client.post("/api-readiness-assessment/api/assess", json=VALID)
    assert res.status_code == 200
    result = res.json()["result"]
    assert 0 <= result["score"] <= 100
    assert "status" in result and "categoryScores" in result

    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM api_readiness_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["full_name"] == "Jordan Lee"


def test_returning_client_upserts(client):
    client.post("/api-readiness-assessment/api/assess", json=VALID)
    bumped = {**VALID, "lead": {**VALID["lead"], "company": "Renamed Systems"}}
    client.post("/api-readiness-assessment/api/assess", json=bumped)

    with db.get_connection() as conn:
        rows = conn.execute("SELECT company FROM api_readiness_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["company"] == "Renamed Systems"


def test_missing_system_types_returns_400(client):
    bad = {**VALID, "answers": {**VALID["answers"], "systemTypes": []}}
    res = client.post("/api-readiness-assessment/api/assess", json=bad)
    assert res.status_code == 400
    assert "systemTypes" in res.json()["fields"]


def test_invalid_enum_returns_400(client):
    bad = {**VALID, "answers": {**VALID["answers"], "apiAvailability": "telepathy"}}
    res = client.post("/api-readiness-assessment/api/assess", json=bad)
    assert res.status_code == 400
    assert "apiAvailability" in res.json()["fields"]
