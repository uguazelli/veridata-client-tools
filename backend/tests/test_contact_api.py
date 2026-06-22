from app import db

VALID = {
    "fullName": "Alex Rivera",
    "email": "Alex@Example.com",
    "company": "Example Co",
    "language": "en",
    "clientId": "client-123",
    "source": "mulesoft-calculator",
}


def test_contact_created_then_upserted(client):
    first = client.post("/api/contact", json=VALID)
    assert first.status_code == 200
    assert first.json()["outcome"] == "created"
    # email normalized to lowercase
    assert first.json()["contact"]["email"] == "alex@example.com"

    second = client.post("/api/contact", json={**VALID, "company": "Renamed Co"})
    assert second.json()["outcome"] == "updated"

    with db.get_connection() as conn:
        rows = conn.execute("SELECT email, company, first_seen, last_seen FROM contacts").fetchall()
    assert len(rows) == 1
    assert rows[0]["company"] == "Renamed Co"
    # first_seen is genuinely preserved across the update
    assert rows[0]["first_seen"] <= rows[0]["last_seen"]


def test_contact_validation_error(client):
    res = client.post("/api/contact", json={**VALID, "email": "nope"})
    assert res.status_code == 400
    assert res.json()["fields"]["email"] == "Enter a valid email address."
