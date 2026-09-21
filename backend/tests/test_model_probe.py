import asyncio

from app.model_probe import (
    GPT_IMAGE_2_SIZES,
    IMAGE_CATALOG,
    VIDEO_CATALOG,
    TEXT_CATALOG,
    available_models,
    _cache,
    _live_ids,
    baidu_catalog_ids,
    is_seedance_id,
    seedance_catalog_row,
    seedance_display_name,
)


def test_image_catalog_declares_generation_capabilities():
    for item in IMAGE_CATALOG:
        params = item["parameters"]
        assert params["sizes"], item["id"]
        assert params["qualities"], item["id"]
        assert params["max_n"] >= 1
        defaults = item["defaultParams"]
        assert defaults["size"] in params["sizes"]
        assert defaults["quality"] in {q["key"] for q in params["qualities"]}


def test_gpt_image_2_capability_table_has_widescreen_presets():
    gpt = next(item for item in IMAGE_CATALOG if item["id"] == "gpt-image-2")
    assert gpt["parameters"]["sizes"] == GPT_IMAGE_2_SIZES
    for size in ("1536x864", "864x1536", "1536x1152", "1152x1536", "1792x768"):
        assert size in gpt["parameters"]["sizes"]


def test_video_catalog_declares_duration_and_resolution():
    for item in VIDEO_CATALOG:
        params = item["parameters"]
        assert params["durations"], item["id"]
        assert params["resolutions"], item["id"]
        defaults = item["defaultParams"]
        assert defaults["resolution"] in params["resolutions"]
        assert defaults["duration"] in params["durations"]
        if params.get("supports_aspect"):
            assert params.get("sizes"), item["id"]
            assert defaults["size"] in params["sizes"]


def test_catalog_ids_are_the_shared_id_space():
    ids = [item["id"] for item in [*IMAGE_CATALOG, *VIDEO_CATALOG, *TEXT_CATALOG]]
    assert len(ids) == len(set(ids))
    assert "gpt-image-2.5-flare" in ids
    assert "happyhorse-1.1-i2v" in ids
    assert "happyhorse-1.1-r2v" in ids
    assert "doubao-seedance-2-0-260128" in ids
    assert "doubao-seedance-2-5-260628" in ids


def test_available_models_keeps_parameters_and_skips_dead_ids(monkeypatch):
    _cache.clear()

    async def fake_live(kind: str) -> set[str]:
        if kind == "image":
            return {IMAGE_CATALOG[0]["id"]}
        return set()

    monkeypatch.setattr("app.model_probe._live_ids", fake_live)
    rows = asyncio.run(available_models("image"))
    assert [row["id"] for row in rows] == [IMAGE_CATALOG[0]["id"]]
    assert rows[0]["parameters"]["sizes"] == IMAGE_CATALOG[0]["parameters"]["sizes"]
    assert rows[0]["defaultParams"]["size"] == IMAGE_CATALOG[0]["defaultParams"]["size"]
    assert rows[0]["isEnabled"] is True


def test_available_models_empty_when_nothing_live(monkeypatch):
    _cache.clear()

    async def fake_live(_kind: str) -> set[str]:
        return set()

    monkeypatch.setattr("app.model_probe._live_ids", fake_live)
    assert asyncio.run(available_models("image")) == []
    assert asyncio.run(available_models("video")) == []


def test_seedance_helpers_match_known_and_unknown_ids():
    assert is_seedance_id("doubao-seedance-2-0-260128")
    assert is_seedance_id("seedance-1.0")
    assert not is_seedance_id("happyhorse-1.1-t2v")
    assert seedance_display_name("doubao-seedance-2-0-fast-260128") == "Seedance 2.0 Fast"
    assert seedance_display_name("doubao-seedance-2-0-mini-260615") == "Seedance 2.0 Mini"
    assert seedance_display_name("doubao-seedance-2-5-260628") == "Seedance 2.5"
    assert seedance_display_name("seedance-preview") == "Seedance"
    catalog = seedance_catalog_row("doubao-seedance-2-5-260628")
    assert catalog["parameters"]["durations"] == [5, 10, 15]
    extra = seedance_catalog_row("seedance-1.0")
    assert extra["owned_by"] == "baidu"
    assert extra["parameters"]["resolutions"] == ["720P", "1080P"]
    assert extra["defaultParams"]["size"] == "1280*720"
    assert set(baidu_catalog_ids()) == {
        "doubao-seedance-2-0-260128",
        "doubao-seedance-2-0-fast-260128",
        "doubao-seedance-2-0-mini-260615",
        "doubao-seedance-2-5-260628",
    }


def test_available_models_lists_seedance_when_baidu_on(monkeypatch):
    _cache.clear()
    monkeypatch.setattr("app.model_probe.settings.baidu_enabled", True)
    monkeypatch.setattr("app.model_probe.settings.baidu_api_key", "baidu-test")

    async def fake_live(kind: str) -> set[str]:
        if kind == "video":
            return {"happyhorse-1.1-t2v", *baidu_catalog_ids()}
        return set()

    monkeypatch.setattr("app.model_probe._live_ids", fake_live)
    rows = asyncio.run(available_models("video"))
    ids = [row["id"] for row in rows]
    assert "happyhorse-1.1-t2v" in ids
    for model_id in baidu_catalog_ids():
        assert model_id in ids
    seedance = next(row for row in rows if row["id"] == "doubao-seedance-2-0-260128")
    assert seedance["name"] == "Seedance 2.0"
    assert seedance["owned_by"] == "baidu"
    assert seedance["isEnabled"] is True
    assert seedance["parameters"]["resolutions"]
    assert seedance["parameters"]["durations"]


def test_available_models_hides_seedance_when_baidu_off_even_if_live(monkeypatch):
    _cache.clear()
    monkeypatch.setattr("app.model_probe.settings.baidu_enabled", False)
    monkeypatch.setattr("app.model_probe.settings.baidu_api_key", "")
    monkeypatch.setattr("app.model_probe.settings.openai_api_key", "sk-test")

    async def fake_live(kind: str) -> set[str]:
        if kind == "video":
            return {"happyhorse-1.1-t2v", "doubao-seedance-2-0-260128", "seedance-1.0"}
        return set()

    monkeypatch.setattr("app.model_probe._live_ids", fake_live)
    ids = [row["id"] for row in asyncio.run(available_models("video"))]
    assert ids == ["happyhorse-1.1-t2v"]
    assert not any("seedance" in item for item in ids)


def test_available_models_does_not_fake_seedance_when_not_live(monkeypatch):
    _cache.clear()
    monkeypatch.setattr("app.model_probe.settings.baidu_enabled", True)
    monkeypatch.setattr("app.model_probe.settings.baidu_api_key", "baidu-test")

    async def fake_live(kind: str) -> set[str]:
        if kind == "video":
            return {"happyhorse-1.1-t2v", "happyhorse-1.1-i2v"}
        return set()

    monkeypatch.setattr("app.model_probe._live_ids", fake_live)
    ids = [row["id"] for row in asyncio.run(available_models("video"))]
    assert ids == ["happyhorse-1.1-t2v", "happyhorse-1.1-i2v"]
    assert not any("seedance" in item for item in ids)


def test_video_live_ids_include_catalog_seedance_when_baidu_configured(monkeypatch):
    async def fake_nexcor() -> set[str]:
        return {"happyhorse-1.1-t2v", "doubao-seedance-2-0-260128", "seedance-1.0"}

    async def fake_baidu() -> set[str]:
        raise AssertionError("catalog Seedance must not depend on GET /models")

    async def fake_probe(_client, model_id: str) -> bool:
        assert "seedance" not in model_id, "seedance must not be POST-probed"
        return False

    monkeypatch.setattr("app.model_probe.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.model_probe.settings.baidu_enabled", True)
    monkeypatch.setattr("app.model_probe.settings.baidu_api_key", "baidu-test")
    monkeypatch.setattr("app.model_probe._nexcor_listed_ids", fake_nexcor)
    monkeypatch.setattr("app.model_probe._baidu_listed_ids", fake_baidu)
    monkeypatch.setattr("app.model_probe._probe_video", fake_probe)
    live = asyncio.run(_live_ids("video"))
    assert "happyhorse-1.1-t2v" in live
    for model_id in baidu_catalog_ids():
        assert model_id in live
    assert "seedance-1.0" not in live


def test_video_live_ids_exclude_seedance_when_baidu_off_even_with_nexcor(monkeypatch):
    async def fake_nexcor() -> set[str]:
        return {"happyhorse-1.1-t2v", "doubao-seedance-2-0-260128", "seedance-1.0"}

    async def fake_probe(_client, model_id: str) -> bool:
        assert "seedance" not in model_id, "seedance must not be POST-probed"
        return False

    monkeypatch.setattr("app.model_probe.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.model_probe.settings.baidu_enabled", False)
    monkeypatch.setattr("app.model_probe.settings.baidu_api_key", "")
    monkeypatch.setattr("app.model_probe._nexcor_listed_ids", fake_nexcor)
    monkeypatch.setattr("app.model_probe._probe_video", fake_probe)
    live = asyncio.run(_live_ids("video"))
    assert "happyhorse-1.1-t2v" in live
    assert not any("seedance" in model_id for model_id in live)
