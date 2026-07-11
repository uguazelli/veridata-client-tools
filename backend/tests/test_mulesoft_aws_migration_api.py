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
    "primaryChallenge": "licensing",
    "muleApplications": 15,
    "targetAwsServices": ["apiGateway", "lambda"]
}


def test_valid_request_returns_download_and_stores_row(client):
    res = client.post("/mulesoft-to-aws-migration/api/request", json=VALID)
    assert res.status_code == 200
    download = res.json()["download"]
    assert download["fileName"] == "MuleSoft_to_AWS_Migration_Calculator_VeriData.xlsx"
    assert download["url"].endswith("/tools/mulesoft-to-aws-migration/MuleSoft_to_AWS_Migration_Calculator_VeriData.xlsx")

    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM mulesoft_aws_migration_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["full_name"] == "Sam Carter"
    assert rows[0]["mule_applications"] == 15
    assert rows[0]["target_aws_services"] == "apiGateway, lambda"


def test_returning_client_upserts(client):
    client.post("/mulesoft-to-aws-migration/api/request", json=VALID)
    client.post("/mulesoft-to-aws-migration/api/request", json={**VALID, "role": "CTO", "muleApplications": 20})

    with db.get_connection() as conn:
        rows = conn.execute("SELECT role, mule_applications FROM mulesoft_aws_migration_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["role"] == "CTO"
    assert rows[0]["mule_applications"] == 20


def test_missing_company_size_returns_400(client):
    res = client.post("/mulesoft-to-aws-migration/api/request", json={**VALID, "companySize": ""})
    assert res.status_code == 400
    assert "companySize" in res.json()["fields"]


def test_negative_mule_applications_returns_400(client):
    res = client.post("/mulesoft-to-aws-migration/api/request", json={**VALID, "muleApplications": -5})
    assert res.status_code == 400
    assert "muleApplications" in res.json()["fields"]
