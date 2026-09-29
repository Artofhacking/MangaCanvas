import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.body_limit import BODY_TOO_LARGE_MESSAGE, RequestSizeLimitMiddleware


@pytest.fixture
def client():
    application = FastAPI()
    application.add_middleware(RequestSizeLimitMiddleware, max_bytes=32)

    @application.put("/save")
    def save(body: dict):
        return {"ok": True, "keys": list(body)}

    with TestClient(application) as test_client:
        yield test_client


def test_oversized_content_length_is_json_413_not_an_empty_400(client):
    response = client.put(
        "/save",
        content=b'{"canvasData":"' + b"x" * 64 + b'"}',
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413
    assert len(response.content) > 0
    body = response.json()
    assert body["code"] == 1001
    assert body["message"] == BODY_TOO_LARGE_MESSAGE
    assert body["data"] is None


def test_body_under_the_limit_reaches_the_app(client):
    response = client.put("/save", json={"name": "ok"})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_middleware_does_not_read_the_body_before_rejecting():
    called = False

    async def app(scope, receive, send):
        nonlocal called
        called = True

    middleware = RequestSizeLimitMiddleware(app, max_bytes=8)
    messages = []

    async def send(message):
        messages.append(message)

    async def receive():
        raise AssertionError("rejected requests must not pull the body")

    import asyncio

    asyncio.run(
        middleware(
            {"type": "http", "headers": [(b"content-length", b"9")], "method": "PUT", "path": "/"},
            receive,
            send,
        )
    )
    assert called is False
    assert messages[0]["status"] == 413
    payload = json.loads(messages[1]["body"])
    assert payload["message"]
    assert len(messages[1]["body"]) > 0
