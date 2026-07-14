def test_large_api_response_is_gzipped(client):
    for index in range(20):
        client.post(
            "/api/decks",
            json={"name": f"Deck {index:02d} " + ("x" * 80)},
        )

    response = client.get("/api/decks", headers={"Accept-Encoding": "gzip"})
    assert response.status_code == 200
    assert response.headers.get("content-encoding") == "gzip"


def test_cors_exposes_pagination_header(client):
    deck = client.post("/api/decks", json={"name": "CORS"}).json()
    response = client.get(
        f"/api/decks/{deck['id']}/cards",
        headers={"Origin": "http://localhost:5173"},
    )
    exposed = response.headers.get("access-control-expose-headers", "").lower()
    assert "x-total-count" in exposed
