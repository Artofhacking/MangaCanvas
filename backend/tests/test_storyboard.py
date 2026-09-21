from app.serialize import normalize_storyboard


def test_normalize_storyboard_renumbers_and_drops_generating():
    shots = normalize_storyboard(
        [
            {
                "id": "a",
                "prompt": "门口对峙",
                "characterIds": ["1", 2, "x"],
                "sceneId": "9",
                "imageUrl": "https://example.com/a.png",
                "status": "generating",
            },
            {"prompt": "第二镜", "status": "failed", "error": "timeout"},
        ]
    )
    assert shots[0]["index"] == 1
    assert shots[0]["characterIds"] == [1, 2]
    assert shots[0]["sceneId"] == 9
    assert shots[0]["status"] == "ready"
    assert shots[1]["index"] == 2
    assert shots[1]["status"] == "failed"
    assert shots[1]["error"] == "timeout"


def test_normalize_storyboard_rejects_junk():
    assert normalize_storyboard(None) == []
    assert normalize_storyboard("nope") == []
    assert normalize_storyboard([{"status": "empty"}])[0]["prompt"] == ""
