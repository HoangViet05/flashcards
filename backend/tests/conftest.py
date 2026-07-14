import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def _register(test_client: TestClient, email: str) -> str:
    res = test_client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123", "name": email.split("@")[0]},
    )
    assert res.status_code == 201, res.text
    return res.json()["access_token"]


@pytest.fixture
def anon_client(db):
    with _make_client(db) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client(db):
    """Authenticated client for user A, used by default in endpoint tests."""
    with _make_client(db) as c:
        token = _register(c, "usera@test.com")
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def user_b_client(client, db):
    """Second authenticated client sharing user A's test database."""
    with _make_client(db) as c:
        token = _register(c, "userb@test.com")
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
