import asyncio
import inspect
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.ai_media import (
    build_minimax_music_body,
    build_minimax_tts_body,
    is_minimax_model,
    minimax_video_generate,
    store_generated_audio,
    submit_minimax_audio,
)
from app.errors import ApiError
from app.routers import ai as ai_router


def _request(body: dict):
    request = MagicMock()
    request.json = AsyncMock(return_value=body)
    request.headers = {}
    return request


def _user():
    return SimpleNamespace(id=1, credits=0)


def test_speech_and_music_are_not_hailuo_video_models():
    assert is_minimax_model("MiniMax-H3")
    assert is_minimax_model("MiniMax-H3-Max")
    assert not is_minimax_model("speech-2.8-hd")
    assert not is_minimax_model("speech-2.8-turbo")
    assert not is_minimax_model("music-3.0")
    source = inspect.getsource(minimax_video_generate)
    assert "generate_audio" not in source
    assert '"audio"' not in source


def test_tts_body_is_non_streaming_url():
    body = build_minimax_tts_body(model="speech-2.8-hd", text="旁白一句", speed=1.2, emotion="calm")
    assert body["model"] == "speech-2.8-hd"
    assert body["stream"] is False
    assert body["output_format"] == "url"
    assert body["text"] == "旁白一句"
    assert body["voice_setting"]["voice_id"] == "Chinese (Mandarin)_Lyrical_Voice"
    assert body["voice_setting"]["speed"] == 1.2
    assert body["voice_setting"]["emotion"] == "calm"
    assert body["audio_setting"]["format"] == "mp3"
    with pytest.raises(ApiError) as empty:
        build_minimax_tts_body(model="speech-2.8-turbo", text="  ")
    assert empty.value.code == 1001


def test_music_body_covers_lyrics_instrumental_and_optimizer():
    vocal = build_minimax_music_body(
        model="music-3.0",
        prompt="indie folk",
        lyrics="[verse]\n夜色",
    )
    assert vocal["model"] == "music-3.0"
    assert vocal["stream"] is False
    assert vocal["output_format"] == "url"
    assert vocal["lyrics"].startswith("[verse]")
    assert "is_instrumental" not in vocal

    instrumental = build_minimax_music_body(model="music-3.0", prompt="rain", instrumental=True)
    assert instrumental["is_instrumental"] is True
    assert "lyrics" not in instrumental

    optimized = build_minimax_music_body(model="music-3.0", prompt="city pop", lyrics_optimizer=True)
    assert optimized["lyrics_optimizer"] is True
    assert "lyrics" not in optimized

    with pytest.raises(ApiError):
        build_minimax_music_body(model="music-3.0", prompt="", lyrics="")


def test_store_generated_audio_decodes_hex_and_downloads_url(monkeypatch, tmp_path):
    monkeypatch.setattr("app.ai_media.settings.upload_dir", tmp_path)
    stored = asyncio.run(store_generated_audio("6869"))
    assert stored.endswith(".mp3")
    assert (tmp_path / "generated" / stored.rsplit("/", 1)[-1]).read_bytes() == b"hi"

    async def fake_remote(url: str) -> str:
        assert url == "https://cdn.example/a.mp3"
        return "/static/uploads/generated/remote.mp3"

    monkeypatch.setattr("app.ai_media.persist_remote_url", fake_remote)
    assert asyncio.run(store_generated_audio("https://cdn.example/a.mp3")) == "/static/uploads/generated/remote.mp3"
    with pytest.raises(ApiError) as missing:
        asyncio.run(store_generated_audio(""))
    assert missing.value.http_status == 502


class _AudioClient:
    posts: list[tuple[str, dict]] = []
    payload: dict = {}
    status: int = 200

    def __init__(self, *_args, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def post(self, url, **kwargs):
        type(self).posts.append((url, kwargs))
        response = MagicMock()
        response.status_code = type(self).status
        response.text = json.dumps(type(self).payload)
        response.json.return_value = type(self).payload
        response.headers = {"content-type": "application/json"}
        return response


def _enable_minimax(monkeypatch):
    monkeypatch.setattr("app.ai_media.settings.minimax_enabled", True)
    monkeypatch.setattr("app.ai_media.settings.minimax_api_key", "minimax-test")
    monkeypatch.setattr("app.ai_media.settings.minimax_base_url", "https://api.minimax.cn")


def test_submit_tts_posts_t2a_and_stores_url(monkeypatch):
    _enable_minimax(monkeypatch)
    _AudioClient.posts = []
    _AudioClient.status = 200
    _AudioClient.payload = {
        "data": {"audio": "https://cdn.example/tts.mp3", "status": 2},
        "base_resp": {"status_code": 0, "status_msg": "success"},
    }
    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", _AudioClient)

    async def fake_remote(url: str) -> str:
        assert url == "https://cdn.example/tts.mp3"
        return "/static/uploads/generated/tts.mp3"

    monkeypatch.setattr("app.ai_media.persist_remote_url", fake_remote)
    body = build_minimax_tts_body(model="speech-2.8-hd", text="你好")
    stored = asyncio.run(submit_minimax_audio("speech-2.8-hd", body))
    assert stored == "/static/uploads/generated/tts.mp3"
    url, kwargs = _AudioClient.posts[0]
    assert url == "https://api.minimax.cn/v1/t2a_v2"
    assert kwargs["json"]["stream"] is False
    assert kwargs["json"]["output_format"] == "url"


def test_submit_music_decodes_hex(monkeypatch, tmp_path):
    _enable_minimax(monkeypatch)
    monkeypatch.setattr("app.ai_media.settings.upload_dir", tmp_path)
    _AudioClient.posts = []
    _AudioClient.status = 200
    _AudioClient.payload = {
        "data": {"audio": "6869", "status": 2},
        "base_resp": {"status_code": 0, "status_msg": "success"},
    }
    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", _AudioClient)
    body = build_minimax_music_body(model="music-3.0", prompt="lofi", lyrics="[verse]\n雨")
    stored = asyncio.run(submit_minimax_audio("music-3.0", body))
    assert stored.endswith(".mp3")
    url, kwargs = _AudioClient.posts[0]
    assert url == "https://api.minimax.cn/v1/music_generation"
    assert kwargs["json"]["lyrics"] == "[verse]\n雨"
    assert kwargs["json"]["output_format"] == "url"


def test_submit_surfaces_minimax_business_error(monkeypatch):
    _enable_minimax(monkeypatch)
    _AudioClient.posts = []
    _AudioClient.status = 200
    _AudioClient.payload = {"base_resp": {"status_code": 2013, "status_msg": "invalid params"}}
    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", _AudioClient)
    with pytest.raises(ApiError) as exc:
        asyncio.run(submit_minimax_audio("speech-2.8-hd", {"model": "speech-2.8-hd", "text": "hi"}))
    assert exc.value.http_status == 502
    assert "invalid params" in exc.value.message


def test_submit_disabled_does_not_post(monkeypatch):
    monkeypatch.setattr("app.ai_media.settings.minimax_enabled", False)
    monkeypatch.setattr("app.ai_media.settings.minimax_api_key", "minimax-test")

    class Boom(_AudioClient):
        async def post(self, url, **kwargs):
            raise AssertionError("disabled channel must not POST")

    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", Boom)
    with pytest.raises(ApiError) as exc:
        asyncio.run(submit_minimax_audio("music-3.0", {"model": "music-3.0"}))
    assert exc.value.http_status == 503


def test_submit_timeout_is_504(monkeypatch):
    _enable_minimax(monkeypatch)

    class TimeoutClient(_AudioClient):
        async def post(self, url, **kwargs):
            raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", TimeoutClient)
    with pytest.raises(ApiError) as exc:
        asyncio.run(submit_minimax_audio("speech-2.8-turbo", {"model": "speech-2.8-turbo"}))
    assert exc.value.http_status == 504


def test_audios_route_returns_image_shaped_url(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "minimax_enabled", True)
    monkeypatch.setattr(ai_router.settings, "minimax_api_key", "minimax-test")
    monkeypatch.setattr(ai_router.settings, "billing_enabled", False)

    async def fake_submit(model, body):
        assert model == "speech-2.8-hd"
        assert body["text"] == "开场白"
        return "/static/uploads/generated/line.mp3"

    monkeypatch.setattr(ai_router, "submit_minimax_audio", fake_submit)
    response = asyncio.run(
        ai_router.audios(_request({"model": "speech-2.8-hd", "text": "开场白", "voiceId": "English_Graceful_Lady"}), _user())
    )
    payload = json.loads(response.body)
    assert payload["code"] == 0
    assert payload["data"]["task"] == "tts"
    assert payload["data"]["model"] == "speech-2.8-hd"
    assert payload["data"]["url"] == "/static/uploads/generated/line.mp3"
    assert payload["data"]["data"] == [{"url": "/static/uploads/generated/line.mp3"}]


def test_audios_route_rejects_sfx_and_closed_channel(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "minimax_enabled", True)
    monkeypatch.setattr(ai_router.settings, "minimax_api_key", "minimax-test")
    monkeypatch.setattr(ai_router.settings, "billing_enabled", False)
    with pytest.raises(ApiError) as sfx:
        asyncio.run(ai_router.audios(_request({"model": "sfx-1", "prompt": "boom"}), _user()))
    assert sfx.value.code == 1001

    monkeypatch.setattr(ai_router.settings, "minimax_enabled", False)

    async def should_not_submit(*_args, **_kwargs):
        raise AssertionError("closed channel must not generate")

    monkeypatch.setattr(ai_router, "submit_minimax_audio", should_not_submit)
    with pytest.raises(ApiError) as closed:
        asyncio.run(ai_router.audios(_request({"model": "music-3.0", "prompt": "lofi", "lyrics": "雨"}), _user()))
    assert closed.value.http_status == 503


def test_models_route_keeps_audio_modality(monkeypatch):
    async def fake_models(kind):
        assert kind == "audio"
        return [{"id": "speech-2.8-hd", "modality": "audio"}]

    monkeypatch.setattr(ai_router, "available_models", fake_models)
    response = asyncio.run(ai_router.models_list("audio", SimpleNamespace()))
    payload = json.loads(response.body)
    assert payload["data"]["list"] == [{"id": "speech-2.8-hd", "modality": "audio"}]
