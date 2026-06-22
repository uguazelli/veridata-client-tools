from app import db

VALID = {
    "fullName": "Alex Rivera",
    "email": "alex@example.com",
    "company": "Example Co",
    "language": "en",
    "deploymentModel": "cloudhub2",
    "commercialModel": "flowMessage",
    "productionCores": 12,
    "sandboxCores": 4,
    "runningApplications": 36,
    "utilizationPct": 72,
    "managedApis": 25,
    "addons": ["apiManager", "mq"],
    "renewalTimeline": "6-12",
}


def test_valid_submission_returns_result_and_stores_one_row(client):
    res = client.post("/mulesoft-calculator/api/calculate", json=VALID)
    assert res.status_code == 200
    assert res.json()["result"]["risk"]["level"] == "Low"

    with db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM mulesoft_leads").fetchall()
    assert len(rows) == 1
    assert rows[0]["full_name"] == "Alex Rivera"


def test_returning_client_upserts_by_email(client):
    client.post("/mulesoft-calculator/api/calculate", json=VALID)
    client.post("/mulesoft-calculator/api/calculate", json={**VALID, "company": "Renamed Co"})

    with db.get_connection() as conn:
        rows = conn.execute("SELECT email, company FROM mulesoft_leads").fetchall()
    assert len(rows) == 1  # upserted, not duplicated
    assert rows[0]["company"] == "Renamed Co"


def test_missing_required_field_returns_400(client):
    res = client.post("/mulesoft-calculator/api/calculate", json={**VALID, "fullName": ""})
    assert res.status_code == 400
    body = res.json()
    assert body["error"] == "Validation failed."
    assert "fullName" in body["fields"]


def test_invalid_email_returns_400(client):
    res = client.post("/mulesoft-calculator/api/calculate", json={**VALID, "email": "bad-email"})
    assert res.status_code == 400
    assert res.json()["fields"]["email"] == "Enter a valid email address."


def test_unknown_deployment_model_returns_400(client):
    res = client.post("/mulesoft-calculator/api/calculate", json={**VALID, "deploymentModel": "mainframe"})
    assert res.status_code == 400
    assert "deploymentModel" in res.json()["fields"]


def test_spanish_localizes_result(client):
    res = client.post("/mulesoft-calculator/api/calculate", json={**VALID, "language": "es", "commercialModel": "unsure"})
    assert res.status_code == 200
    assert res.json()["result"]["language"] == "es"
