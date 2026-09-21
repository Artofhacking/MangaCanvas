import asyncio
import inspect

from app.ai_media import (
    build_happyhorse_video_body,
    build_nexcor_seedance_video_body,
    mention_image_roles,
    openai_video_generate,
    resolve_vidu_r2v_model,
    resolve_video_model,
    vidu_subject_name,
    vidu_video_generate,
    video_image_data_uri,
)
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


def test_happyhorse_r2v_keeps_all_refs_and_audio():
    body = build_happyhorse_video_body(
        model="happyhorse-1.1-r2v",
        prompt="老张取笑老林。",
        size="1280*720",
        duration=5,
        image_urls=["https://img/a.png", "https://img/b.png", "https://img/c.png"],
        names=["老林", "塑料菜袋", "老张"],
    )
    assert body["model"] == "happyhorse-1.1-r2v"
    assert body["audio"] is True
    assert body["images"] == ["https://img/a.png", "https://img/b.png", "https://img/c.png"]
    assert body["reference_images"] == body["images"]
    assert [item["type"] for item in body["metadata"]["input"]["media"]] == ["reference_image"] * 3
    assert "第1张参考图是老林" in body["prompt"]


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
    assert body["img_url"] == "https://img/a.png"
    assert body["metadata"]["input"]["media"][0]["type"] == "first_frame"


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
