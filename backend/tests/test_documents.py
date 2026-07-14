import fitz

from app.routers import documents


def _upload_pdf(test_client, monkeypatch):
    pdf = fitz.open()
    pdf.new_page()
    pdf_bytes = pdf.tobytes()
    pdf.close()

    monkeypatch.setattr(documents, "storage_enabled", lambda: True)
    monkeypatch.setattr(
        documents,
        "upload_public_file",
        lambda *args, **kwargs: "https://storage.test/documents/test.pdf",
    )
    monkeypatch.setattr(documents, "delete_public_file_url", lambda *args, **kwargs: None)
    return test_client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )


def test_documents_require_auth(anon_client):
    assert anon_client.get("/api/documents").status_code == 401


def test_documents_scoped_per_user(client, user_b_client, monkeypatch):
    res = _upload_pdf(client, monkeypatch)
    assert res.status_code == 200, res.text
    doc_id = res.json()["id"]

    assert len(client.get("/api/documents").json()) == 1
    assert user_b_client.get("/api/documents").json() == []
    assert user_b_client.get(f"/api/documents/{doc_id}").status_code == 404
    assert user_b_client.delete(f"/api/documents/{doc_id}").status_code == 404


def test_ai_requires_auth(anon_client):
    assert anon_client.post("/api/ai/generate", json={"word": "test"}).status_code == 401
