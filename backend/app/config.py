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
    seed_email: str = "superadmin@artofhacking.com"
    seed_password: str = "123456"
    seed_username: str = "superadmin"
    upload_dir: Path = ROOT / "uploads"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
(ROOT / "data").mkdir(parents=True, exist_ok=True)
