import asyncio
import inspect
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.errors import ApiError
from app.routers import ai as ai_router
from app.routers.ai import images


def _request(body: dict):
    request = MagicMock()
    request.json = AsyncMock(return_value=body)
    return request


def _user():
    return SimpleNamespace(id=1, credits=0)


def test_images_handler_does_not_return_placeholder():
    source = inspect.getsource(ai_router.images)
    assert "persist_placeholder" not in source
    helper = inspect.getsource(ai_router._persist_generated_url)
    assert "persist_placeholder" not in helper


def test_persist_generated_url_fails_when_missing():
    with pytest.raises(ApiError) as exc:
        asyncio.run(ai_router._persist_generated_url(None))
    assert exc.value.code == 3001
    assert exc.value.http_status == 502
    assert "未找到图片" in exc.value.message


def test_persist_generated_url_does_not_swallow_persist_errors(monkeypatch):
    async def boom(_url: str):
        raise ApiError(3001, "拉取生成结果失败: 404", 502)

    monkeypatch.setattr(ai_router, "persist_remote_url", boom)
    with pytest.raises(ApiError) as exc:
        asyncio.run(ai_router._persist_generated_url("https://example.com/a.png"))
    assert "拉取生成结果失败" in exc.value.message
    assert exc.value.http_status == 502


def test_images_missing_api_key_fails(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "openai_api_key", "")
    monkeypatch.setattr(ai_router.settings, "dashscope_api_key", "")
    with pytest.raises(ApiError) as exc:
        asyncio.run(images(_request({"model": "gpt-image-2", "prompt": "lineart"}), _user(), MagicMock()))
    assert exc.value.code == 3001
    assert exc.value.http_status == 503
    assert "API Key" in exc.value.message


def test_images_empty_upstream_url_fails(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "dashscope_api_key", "ds-key")

    async def fake_dashscope(*_args, **_kwargs):
        return {}

    monkeypatch.setattr(ai_router, "dashscope_async", fake_dashscope)
    monkeypatch.setattr(ai_router, "extract_media_url", lambda _payload: None)
    with pytest.raises(ApiError) as exc:
        asyncio.run(images(_request({"model": "wan2.7-image", "prompt": "lineart"}), _user(), MagicMock()))
    assert exc.value.code == 3001
    assert exc.value.http_status == 502
    assert "未找到图片" in exc.value.message


def test_images_persist_failure_is_error(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "dashscope_api_key", "ds-key")

    async def fake_dashscope(*_args, **_kwargs):
        return {"output": {"results": [{"url": "https://example.com/missing.png"}]}}

    async def boom(_url: str):
        raise ApiError(3001, "拉取生成结果失败: 404", 502)

    monkeypatch.setattr(ai_router, "dashscope_async", fake_dashscope)
    monkeypatch.setattr(ai_router, "extract_media_url", lambda _payload: "https://example.com/missing.png")
    monkeypatch.setattr(ai_router, "persist_remote_url", boom)
    with pytest.raises(ApiError) as exc:
        asyncio.run(images(_request({"model": "wan2.7-image", "prompt": "lineart"}), _user(), MagicMock()))
    assert exc.value.http_status == 502
    assert "拉取生成结果失败" in exc.value.message


def test_openai_empty_payload_fails_instead_of_placeholder(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(ai_router.settings, "dashscope_api_key", "")

    async def fake_openai(**_kwargs):
        return {"data": []}

    monkeypatch.setattr(ai_router, "openai_image_generate", fake_openai)
    monkeypatch.setattr(ai_router, "persist_openai_images", lambda _payload: [])
    monkeypatch.setattr(ai_router, "extract_media_url", lambda _payload: None)
    with pytest.raises(ApiError) as exc:
        asyncio.run(images(_request({"model": "gpt-image-2", "prompt": "lineart"}), _user(), MagicMock()))
    assert exc.value.http_status == 502
    assert "未找到图片" in exc.value.message


def test_images_returns_persisted_url(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "openai_api_key", "sk-test")

    async def fake_openai(**_kwargs):
        return {"data": [{"url": "https://cdn.example/a.png"}]}

    async def fake_persist(url: str):
        assert url == "https://cdn.example/a.png"
        return "/static/uploads/generated/a.png"

    monkeypatch.setattr(ai_router, "openai_image_generate", fake_openai)
    monkeypatch.setattr(ai_router, "persist_openai_images", lambda _payload: ["https://cdn.example/a.png"])
    monkeypatch.setattr(ai_router, "_is_local_url", lambda _url: False)
    monkeypatch.setattr(ai_router, "persist_remote_url", fake_persist)

    resp = asyncio.run(images(_request({"model": "gpt-image-2", "prompt": "ok"}), _user(), MagicMock()))
    body = json.loads(resp.body)
    assert body["code"] == 0
    assert body["data"]["data"][0]["url"] == "/static/uploads/generated/a.png"
