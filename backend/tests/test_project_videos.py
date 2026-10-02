from app.project_videos import is_project_video


def test_video_library_includes_canvas_saves_and_video_files():
    assert is_project_video("https://cdn.example/a", {"category": "video", "mediaType": "video"}) is True
    assert is_project_video("https://cdn.example/clip", {"category": "object", "mediaType": "video"}) is True
    assert is_project_video("/static/uploads/assets/take.webm?token=1", None) is True
    assert is_project_video('{"no":1}', None) is False


def test_video_library_skips_stills():
    assert is_project_video("https://cdn.example/cover.png", {"category": "character", "mediaType": "image"}) is False
    assert is_project_video("", {"category": "scene"}) is False
    assert is_project_video(None, None) is False
