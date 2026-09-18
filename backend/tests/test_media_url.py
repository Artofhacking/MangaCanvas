from app.util import media_path, rewrite_media_tree, rewrite_stored_media_url


def test_rewrite_keeps_path_and_drops_stale_origin():
    assert media_path("http://any-host:80/static/uploads/generated/a.png") == "/static/uploads/generated/a.png"
    assert media_path("http://any-host:18999/static/uploads/generated/a.png?x=1") == "/static/uploads/generated/a.png?x=1"
    assert rewrite_stored_media_url("https://old.example/static/uploads/generated/a.png") == "/static/uploads/generated/a.png"


def test_rewrite_keeps_external_and_relative():
    unsplash = "https://images.unsplash.com/photo-1"
    assert rewrite_stored_media_url(unsplash) == unsplash
    assert rewrite_stored_media_url("/static/uploads/generated/a.png") == "/static/uploads/generated/a.png"


def test_rewrite_canvas_tree():
    canvas = {
        "nodes": [
            {"type": "image", "data": {"url": "http://old-host/static/uploads/generated/a.png"}},
            {"type": "text", "data": {"content": "http://old-host/#/project/6"}},
        ]
    }
    out = rewrite_media_tree(canvas)
    assert out["nodes"][0]["data"]["url"] == "/static/uploads/generated/a.png"
    assert out["nodes"][1]["data"]["content"] == "http://old-host/#/project/6"
