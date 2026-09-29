import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ensure-nginx-spa.py"


def _load():
    spec = importlib.util.spec_from_file_location("ensure_nginx_spa", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_templates_agree_on_128m_and_json_413():
    deploy = (ROOT / "deploy" / "nginx" / "mangacanvas.conf").read_text()
    legacy = (ROOT / "scripts" / "nginx" / "mangacanvas.conf").read_text()
    for text in (deploy, legacy):
        assert "client_max_body_size 128m;" in text
        assert "error_page 413 @canvas_body_too_large;" in text
        assert "请求体过大，未能写入" in text
        assert "client_max_body_size 32m;" not in text
        assert "client_max_body_size 100m;" not in text


def test_existing_host_conf_is_patched_in_place_and_stays_idempotent():
    module = _load()
    original = """server {
    listen 18999;
    server_name _;
    client_max_body_size 1m;

    location /api/ {
        proxy_pass http://127.0.0.1:8088;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
"""
    patched = module.ensure_canvas_body_limits(original)
    assert "client_max_body_size 128m;" in patched
    assert "client_max_body_size 1m;" not in patched
    assert "error_page 413 @canvas_body_too_large;" in patched
    assert "location @canvas_body_too_large" in patched
    assert patched.index("location @canvas_body_too_large") < patched.index("location / {")
    assert module.ensure_canvas_body_limits(patched) == patched


def test_missing_body_limit_is_inserted():
    module = _load()
    original = """server {
    listen 18999;
    server_name _;

    location / {
        try_files $uri /index.html;
    }
}
"""
    patched = module.ensure_canvas_body_limits(original)
    assert "client_max_body_size 128m;" in patched
    assert "请求体过大，未能写入" in patched
    again = module.ensure_canvas_body_limits(patched)
    assert again == patched
