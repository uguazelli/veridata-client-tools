import pytest
from fastapi.testclient import TestClient

from app import db
from app.config import settings
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Isolate each test with its own SQLite file.
    monkeypatch.setattr(settings, "db_path", tmp_path / "app.db")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def conn():
    return db.get_connection
