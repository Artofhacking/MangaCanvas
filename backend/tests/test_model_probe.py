import asyncio

from app.model_probe import (
    GPT_IMAGE_2_SIZES,
    IMAGE_CATALOG,
    VIDEO_CATALOG,
    TEXT_CATALOG,
    available_models,
    _cache,
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
