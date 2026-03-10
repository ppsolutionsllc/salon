from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    DATABASE_URL: str
    REDIS_URL: str
    UPLOADS_DIR: str = "/var/app/uploads"
    DEPLOY_STATE_FILE: str = "/var/app/deploy/state.env"
    DEPLOY_RELEASES_LOG: str = "/var/app/deploy/releases.log"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
