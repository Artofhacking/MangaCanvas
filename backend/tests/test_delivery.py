from app.delivery import build_episode_delivery, delivery_filename
from app.serialize import normalize_storyboard


def test_delivery_filename_extension_and_code():
    assert delivery_filename("EP 01", 12, "https://cdn.example.com/x.JPEG?token=1") == "EP_01_镜12.jpeg"
    assert delivery_filename("  ", 1, "/static/noext") == "episode_镜01.png"
    assert delivery_filename("第1集", 1, "/static/a.png") == "第1集_镜01.png"


def test_build_episode_delivery_orders_finalized_and_lists_gaps():
    payload = build_episode_delivery(
        {
            "id": 9,
            "name": "雾城夜戏",
            "code": "EP_01",
            "storyboard": [
                {
                    "id": "c",
                    "index": 3,
                    "prompt": "收剑",
                    "imageUrl": "/static/c.png",
                    "finalized": True,
                    "finalizedImageUrl": "/static/c.png",
                },
                {"id": "a", "index": 1, "prompt": "推门", "imageUrl": "/static/a.png", "finalized": False},
                {"id": "b", "index": 2, "prompt": "对峙", "status": "empty"},
                {"id": "d", "index": 4, "prompt": "空定稿", "finalized": True},
            ],
        }
    )
    assert [item["shotNumber"] for item in payload["items"]] == [3]
    assert payload["items"][0]["filename"] == "EP_01_镜03.png"
    assert payload["items"][0]["fileUrl"] == "/static/c.png"
    assert payload["gaps"] == [
        {"shotId": "a", "shotNumber": 1, "prompt": "推门", "reason": "unfinalized"},
        {"shotId": "b", "shotNumber": 2, "prompt": "对峙", "reason": "no-frame"},
        {"shotId": "d", "shotNumber": 4, "prompt": "空定稿", "reason": "missing-file"},
    ]
    assert payload["export"]["zip"] is False
    assert "zip" in payload["export"]["note"]


def test_normalize_storyboard_keeps_finalized_take():
    shots = normalize_storyboard(
        [
            {
                "id": "a",
                "prompt": "门口",
                "imageUrl": "/static/a.png",
                "finalized": True,
                "finalizedImageUrl": "/static/locked.png",
                "finalizedAt": "2026-10-02T00:00:00.000Z",
                "status": "ready",
            },
            {"id": "b", "prompt": "空", "finalized": True, "status": "empty"},
        ]
    )
    assert shots[0]["finalized"] is True
    assert shots[0]["finalizedImageUrl"] == "/static/locked.png"
    assert shots[0]["finalizedAt"] == "2026-10-02T00:00:00.000Z"
    assert shots[1]["finalized"] is False
    assert "finalizedImageUrl" not in shots[1]


def test_empty_storyboard_is_an_empty_package():
    payload = build_episode_delivery({"id": 1, "name": "空集", "code": "EP_00", "storyboard": []})
    assert payload["items"] == []
    assert payload["gaps"] == []
