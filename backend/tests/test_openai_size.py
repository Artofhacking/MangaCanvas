import math

import pytest

from app.ai_media import openai_size, parse_image_size
from app.errors import ApiError
from app.model_probe import GPT_IMAGE_2_SIZES, GPT_IMAGE_SIZES, IMAGE_CATALOG


def _ratio_label(width: int, height: int) -> str:
    divisor = math.gcd(width, height)
    reduced = (width // divisor, height // divisor)
    return { (7, 3): "21:9", (3, 7): "9:21" }.get(reduced, f"{reduced[0]}:{reduced[1]}")


def test_openai_size_passthrough_presets_and_star_separator():
    assert openai_size(None) == "1024x1024"
    assert openai_size("") == "1024x1024"
    assert openai_size("auto") == "1024x1024"
    assert openai_size("1536*864") == "1536x864"
    assert openai_size("1536×864") == "1536x864"
    assert openai_size("1792x768") == "1792x768"
    assert openai_size("1152x1536") == "1152x1536"


def test_openai_size_does_not_squash_valid_non_preset_sizes():
    # Former mapping collapsed these Wan leftovers onto the old three GPT sizes.
    assert openai_size("1696x960") == "1696x960"
    assert openai_size("1280*720") == "1280x720"
    assert openai_size("1280x1280") == "1280x1280"
    assert openai_size("1440x1440") == "1440x1440"
    assert openai_size("960x1696") == "960x1696"


def test_openai_size_rejects_invalid_alignment_ratio_or_bounds():
    with pytest.raises(ApiError) as not_aligned:
        openai_size("1023x1024")
    assert not_aligned.value.code == 1001
    assert "16" in not_aligned.value.message

    with pytest.raises(ApiError) as too_wide:
        openai_size("3840x16")  # 240:1
    assert too_wide.value.code == 1001

    with pytest.raises(ApiError) as too_big:
        openai_size("4096x4096")
    assert too_big.value.code == 1001


def test_gpt_image_2_presets_are_valid_openai_sizes():
    expected = {"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"}
    seen: set[str] = set()
    for size in GPT_IMAGE_2_SIZES:
        assert openai_size(size) == size
        parsed = parse_image_size(size)
        assert parsed is not None
        width, height = parsed
        assert width % 16 == 0 and height % 16 == 0
        seen.add(_ratio_label(width, height))
    assert seen == expected
    assert "1024x1024" in GPT_IMAGE_2_SIZES
    assert "1536x1024" in GPT_IMAGE_2_SIZES
    assert "1024x1536" in GPT_IMAGE_2_SIZES


def test_qwen_keeps_the_original_three_sizes():
    assert GPT_IMAGE_SIZES == ["1024x1024", "1024x1536", "1536x1024"]
    qwen = next(item for item in IMAGE_CATALOG if item["id"] == "qwen-image-2.0")
    assert qwen["parameters"]["sizes"] == GPT_IMAGE_SIZES


def test_gpt_family_catalog_exposes_expanded_sizes():
    for model_id in ("gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"):
        row = next(item for item in IMAGE_CATALOG if item["id"] == model_id)
        assert row["parameters"]["sizes"] == GPT_IMAGE_2_SIZES
        assert row["defaultParams"]["size"] == "1024x1024"
