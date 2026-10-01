import asyncio
import base64
import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.ai_media import (
    IMAGE_GENERATION_TIMEOUT_MESSAGE,
    OPENAI_IMAGE_DEADLINE_SECONDS,
    build_happyhorse_video_body,
    happyhorse_dashscope_body,
    happyhorse_variant,
    build_nexcor_seedance_video_body,
    mention_image_roles,
    openai_image_generate,
    openai_image_http_timeout,
    openai_video_generate,
    resolve_vidu_r2v_model,
    resolve_video_model,
    vidu_subject_name,
    vidu_video_generate,
    video_image_data_uri,
)
from app.errors import ApiError
from app.routers import ai as ai_router


def test_r2v_never_uses_q3_pro():
    assert resolve_vidu_r2v_model("viduq3-pro") == "viduq2"
    assert resolve_vidu_r2v_model("happyhorse-1.1-r2v") == "viduq2"
    assert resolve_vidu_r2v_model("viduq2") == "viduq2"
    assert resolve_vidu_r2v_model("viduq3") == "viduq3"


def test_subject_name_keeps_chinese():
    assert vidu_subject_name("老林", 0) == "老林"
    assert vidu_subject_name("小区 单元门前", 2) == "小区单元门前"
    assert vidu_subject_name("", 0) == "图1"


def test_mention_image_roles_prefixes_plot():
    prompt = mention_image_roles("老张取笑老林。", ["老林", "老张", "小区单元门前"])
    assert prompt.startswith("第1张参考图是老林，第2张参考图是老张，第3张参考图是小区单元门前。")
    assert "老张取笑老林。" in prompt
    assert "有声视频" in prompt
    assert mention_image_roles(prompt, ["老林"]) == prompt


def test_happyhorse_multi_ref_degrades_to_i2v_first_frame():
    body = build_happyhorse_video_body(
        model="happyhorse-1.1-r2v",
        prompt="老张取笑老林。",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png", "https://img/b.png", "https://img/c.png"],
        names=["老林", "塑料菜袋", "老张"],
        ratio="4:5",
    )
    assert body["model"] == "happyhorse-1.1-i2v"
    assert "r2v" not in body["model"]
    assert "ratio" not in body
    assert "size" not in body
    assert body["resolution"] == "720P"
    assert body["audio"] is True
    assert body["images"] == ["https://img/a.png"]
    assert "reference_images" not in body
    assert body["metadata"]["input"]["media"] == [{"type": "first_frame", "url": "https://img/a.png"}]
    assert "第1张参考图是老林" in body["prompt"]
    assert "塑料菜袋" not in body["prompt"]


def test_seedance_nexcor_body_keeps_id_and_does_not_become_happyhorse():
    body = build_nexcor_seedance_video_body(
        model="doubao-seedance-2-0-260128",
        prompt="run",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png"],
    )
    assert body["model"] == "doubao-seedance-2-0-260128"
    assert body["images"] == ["https://img/a.png"]
    assert body["metadata"]["input"]["media"][0]["type"] == "first_frame"
    empty = build_nexcor_seedance_video_body(
        model="seedance-1.0",
        prompt="run",
        size="1920*1080",
        duration=10,
        resolution="1080P",
        image_urls=[],
    )
    assert empty["model"] == "seedance-1.0"
    assert empty["resolution"] == "1080p"
    assert "images" not in empty
    assert resolve_video_model("doubao-seedance-2-0-260128", True) == "doubao-seedance-2-0-260128"


def test_happyhorse_single_image_stays_i2v():
    body = build_happyhorse_video_body(
        model="happyhorse-1.1-i2v",
        prompt="门开了",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png"],
    )
    assert body["model"] == "happyhorse-1.1-i2v"
    assert body["audio"] is True
    assert "ratio" not in body
    assert "size" not in body
    assert body["resolution"] == "720P"
    assert body["img_url"] == "https://img/a.png"
    assert body["metadata"]["input"]["media"][0]["type"] == "first_frame"


def test_happyhorse_ratio_follows_reference_count():
    t2v = build_happyhorse_video_body(
        model="happyhorse-1.1-r2v",
        prompt="空镜",
        size="1280*720",
        duration=5,
        image_urls=[],
        ratio="21:9",
        resolution="1080P",
    )
    assert t2v["model"] == "happyhorse-1.1-t2v"
    assert t2v["ratio"] == "21:9"
    assert t2v["resolution"] == "1080P"
    assert t2v["size"] == "2520*1080"

    i2v = build_happyhorse_video_body(
        model="happyhorse-1.1-r2v",
        prompt="开门",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png"],
        ratio="16:9",
    )
    assert i2v["model"] == "happyhorse-1.1-i2v"
    assert "ratio" not in i2v

    multi = build_happyhorse_video_body(
        model="happyhorse-1.1-t2v",
        prompt="双人",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png", "https://img/b.png"],
        ratio="4:5",
        resolution="720P",
    )
    assert multi["model"] == "happyhorse-1.1-i2v"
    assert "r2v" not in multi["model"]
    assert "ratio" not in multi
    assert "size" not in multi
    assert multi["images"] == ["https://img/a.png"]
    dash = happyhorse_dashscope_body(
        model="happyhorse-1.1-t2v",
        prompt="双人",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png", "https://img/b.png"],
        ratio="4:5",
        resolution="720P",
    )
    assert dash["model"] == "happyhorse-1.1-i2v"
    assert "r2v" not in dash["model"]
    assert "ratio" not in dash["parameters"]
    assert dash["input"]["media"] == [{"type": "first_frame", "url": "https://img/a.png"}]
    i2v_dash = happyhorse_dashscope_body(
        model="happyhorse-1.1-t2v",
        prompt="开门",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png"],
        ratio="16:9",
    )
    assert i2v_dash["model"] == "happyhorse-1.1-i2v"
    assert "ratio" not in i2v_dash["parameters"]
    assert i2v_dash["input"]["media"][0]["type"] == "first_frame"


def test_happyhorse_variant_never_selects_r2v():
    assert happyhorse_variant(0) == "happyhorse-1.1-t2v"
    assert happyhorse_variant(1) == "happyhorse-1.1-i2v"
    assert happyhorse_variant(2) == "happyhorse-1.1-i2v"
    assert happyhorse_variant(3) == "happyhorse-1.1-i2v"
    for count in (0, 1, 2, 3):
        assert "r2v" not in happyhorse_variant(count)
    assert resolve_video_model("happyhorse-1.1-r2v", False) == "happyhorse-1.1-t2v"
    assert resolve_video_model("happyhorse-1.1-r2v", True) == "happyhorse-1.1-i2v"
    assert resolve_video_model("happyhorse-1.1-t2v", True) == "happyhorse-1.1-i2v"
    assert resolve_video_model("happy-horse-1.1-r2v", True) == "happyhorse-1.1-i2v"
    assert "r2v" not in resolve_video_model("happyhorse-1.1-r2v", True)


def test_multi_ref_no_longer_hijacks_disabled_vidu():
    source = inspect.getsource(ai_router.videos)
    assert "allow_disabled" not in source
    assert "vidu_video_generate" not in source.split("if is_vidu_model")[0]
    assert "allow_disabled" not in inspect.signature(vidu_video_generate).parameters
    source_openai = inspect.getsource(openai_video_generate)
    assert "vidu_video_generate" not in source_openai


def test_video_image_data_uri_passthrough():
    uri = "data:image/png;base64,abcd"
    assert asyncio.run(video_image_data_uri(uri)) == uri


def test_openai_image_deadline_stays_under_gateway():
    assert OPENAI_IMAGE_DEADLINE_SECONDS == 540
    assert OPENAI_IMAGE_DEADLINE_SECONDS < 600
    timeout = openai_image_http_timeout()
    assert timeout.read == OPENAI_IMAGE_DEADLINE_SECONDS
    assert timeout.connect <= 30
    assert timeout.write <= 90


class _ImageClient:
    posts: list[tuple[str, dict]] = []

    def __init__(self, *_args, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def post(self, url, **kwargs):
        type(self).posts.append((url, kwargs))
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"data": [{"b64_json": "aaa"}]}
        return response


def _data_url(payload: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(payload).decode()


def test_openai_image_without_refs_stays_text_to_image(monkeypatch):
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.ai_media.settings.openai_base_url", "https://example.test/v1")
    _ImageClient.posts = []
    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", _ImageClient)

    payload = asyncio.run(
        openai_image_generate(prompt="lineart", model="gpt-image-2", size="1024x1024", n=1, quality="low")
    )

    assert payload["data"][0]["b64_json"] == "aaa"
    url, kwargs = _ImageClient.posts[0]
    assert url == "https://example.test/v1/images/generations"
    assert "files" not in kwargs
    assert kwargs["json"]["model"] == "gpt-image-2"


def test_openai_image_edits_uploads_every_reference(monkeypatch):
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.ai_media.settings.openai_base_url", "https://example.test/v1")
    _ImageClient.posts = []
    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", _ImageClient)

    asyncio.run(
        openai_image_generate(
            prompt="@2 穿上 @1",
            model="gpt-image-2",
            size="1536x1024",
            n=1,
            quality="low",
            images=[_data_url(b"dress"), _data_url(b"sheet")],
        )
    )

    url, kwargs = _ImageClient.posts[0]
    assert url == "https://example.test/v1/images/edits"
    names = [item[1][0] for item in kwargs["files"]]
    bodies = [item[1][1] for item in kwargs["files"]]
    assert names == ["reference_0.png", "reference_1.png"]
    assert bodies == [b"dress", b"sheet"]
    assert kwargs["data"]["quality"] == "low"
    assert kwargs["data"]["size"] == "1536x1024"


def test_openai_image_read_timeout_is_a_clear_error(monkeypatch):
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.ai_media.settings.openai_base_url", "https://example.test/v1")

    class TimeoutClient(_ImageClient):
        async def post(self, url, **kwargs):
            raise httpx.ReadTimeout("The read operation timed out")

    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", TimeoutClient)
    with pytest.raises(ApiError) as exc:
        asyncio.run(
            openai_image_generate(
                prompt="dress",
                model="gpt-image-2",
                size="1536x1024",
                n=1,
                quality="low",
                images=[_data_url(b"dress")],
            )
        )
    assert exc.value.code == 3001
    assert exc.value.http_status == 504
    assert exc.value.message == IMAGE_GENERATION_TIMEOUT_MESSAGE


def test_openai_image_deadline_cancels_a_slow_upstream(monkeypatch):
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.ai_media.settings.openai_base_url", "https://example.test/v1")
    monkeypatch.setattr("app.ai_media.OPENAI_IMAGE_DEADLINE_SECONDS", 0.05)

    class SlowClient(_ImageClient):
        async def post(self, url, **kwargs):
            await asyncio.sleep(2)
            raise AssertionError("slow upstream should have been cancelled")

    monkeypatch.setattr("app.ai_media.httpx.AsyncClient", SlowClient)
    with pytest.raises(ApiError) as exc:
        asyncio.run(
            openai_image_generate(prompt="dress", model="gpt-image-2", size="1024x1024", n=1, quality="low")
        )
    assert exc.value.message == IMAGE_GENERATION_TIMEOUT_MESSAGE
    assert exc.value.http_status == 504


def test_images_route_reports_upstream_timeout(monkeypatch):
    monkeypatch.setattr(ai_router.settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(ai_router.settings, "dashscope_api_key", "")
    monkeypatch.setattr(ai_router.settings, "billing_enabled", False)

    async def boom(**_kwargs):
        raise httpx.ReadTimeout("")

    monkeypatch.setattr(ai_router, "openai_image_generate", boom)
    request = MagicMock()
    request.json = AsyncMock(return_value={"model": "gpt-image-2", "prompt": "dress", "images": ["a", "b"]})
    request.headers = {}
    with pytest.raises(ApiError) as exc:
        asyncio.run(ai_router.images(request, SimpleNamespace(id=1)))
    assert exc.value.code == 3001
    assert exc.value.http_status == 504
    assert exc.value.message == IMAGE_GENERATION_TIMEOUT_MESSAGE
