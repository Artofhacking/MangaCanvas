from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_host: str = "0.0.0.0"
    app_port: int = 8088
    public_base_url: str = "http://localhost:8088"
    database_url: str = f"sqlite:///{ROOT / 'data' / 'mangacanvas.db'}"
    jwt_secret: str = "mangacanvas-dev-secret-change-me"
    jwt_expire_seconds: int = 604800
    refresh_expire_seconds: int = 2592000
    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    openai_api_key: str = ""
    openai_base_url: str = "https://cc.nexcor.ai/v1"
    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    baidu_api_key: str = ""
    baidu_base_url: str = "https://ai-gateway.baidubce.com"
    baidu_enabled: bool = False
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.cn"
    minimax_enabled: bool = False
    vidu_api_key: str = ""
    vidu_base_url: str = "https://api.vidu.cn"
    vidu_enabled: bool = False
    baidu_vod_ak: str = ""
    baidu_vod_sk: str = ""
    baidu_vod_endpoint: str = "https://vod.baidubce.com"
    seed_email: str = "superadmin@artofhacking.com"
    seed_password: str = "123456"
    seed_username: str = "superadmin"
    allow_registration: bool = False
    billing_enabled: bool = False
    billing_enforce_quotas: bool = False
    allow_placeholder: bool = False
    upload_dir: Path = ROOT / "uploads"
    feishu_app_id: str = ""
    feishu_app_secret: str = ""
    feishu_redirect_origins: str = (
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://47.104.138.144:18999"
    )

    def baidu_root(self) -> str:
        return _strip_root(self.baidu_base_url or "https://ai-gateway.baidubce.com", ("/api/v3", "/v1"))

    def minimax_root(self) -> str:
        return _strip_root(self.minimax_base_url or "https://api.minimax.cn", ("/v2", "/v1"))

    def vidu_root(self) -> str:
        return _strip_root(self.vidu_base_url or "https://api.vidu.cn", ("/ent/v2", "/v2"))


def _strip_root(url: str, suffixes: tuple[str, ...]) -> str:
    base = url.rstrip("/")
    for suffix in suffixes:
        if base.endswith(suffix):
            return base[: -len(suffix)].rstrip("/")
    return base


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
(ROOT / "data").mkdir(parents=True, exist_ok=True)
