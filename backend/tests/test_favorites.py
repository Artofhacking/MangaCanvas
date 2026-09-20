from app.favorites import is_collected_metadata


def test_is_collected_metadata_accepts_favorite_or_collect_source():
    assert is_collected_metadata({"source": "favorite", "category": "scene"}) is True
    assert is_collected_metadata({"source": "collect"}) is True


def test_is_collected_metadata_accepts_favorited_at():
    assert is_collected_metadata({"favoritedAt": "2026-09-20T05:00:00.000Z"}) is True


def test_is_collected_metadata_rejects_ordinary_assets():
    assert is_collected_metadata({"status": "approved", "category": "character"}) is False
    assert is_collected_metadata(None) is False
    assert is_collected_metadata("favorite") is False
