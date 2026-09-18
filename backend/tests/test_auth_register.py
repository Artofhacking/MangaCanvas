from unittest.mock import MagicMock

import pytest

from app.errors import ApiError
from app.routers.auth import RegisterIn, register


def test_register_rejected_when_closed(monkeypatch):
    monkeypatch.setattr("app.security.settings.allow_registration", False)
    with pytest.raises(ApiError) as exc:
        register(RegisterIn(username="n", email="n@example.com", password="secret"), db=MagicMock())
    assert exc.value.code == 2003
    assert exc.value.http_status == 403
    assert "暂不开放注册" in exc.value.message
