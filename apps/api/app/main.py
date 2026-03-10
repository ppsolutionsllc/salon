from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title="Salon CRM API",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if settings.ENVIRONMENT != "production" and not cors_origins:
    cors_origins = ["*"]

# Trust X-Forwarded-* headers from reverse proxy.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

trusted_hosts = [host.strip() for host in settings.TRUSTED_HOSTS.split(",") if host.strip()]
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ([] if settings.ENVIRONMENT == "production" else ["*"]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/v1/health")
def api_v1_health_check():
    return {"status": "ok"}
