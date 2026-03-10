# SALON: FastAPI + Next.js + Postgres + Redis

Production-ready монорепозиторий для работы за Nginx Proxy Manager (NPM) без отдельного внутреннего nginx в основном сценарии.

## Архитектура (production)

- `web` (Next.js standalone) слушает `3000` в контейнере, наружу публикуется `8080`.
- `api` (FastAPI) и `worker` работают только во внутренней docker-сети.
- `db` и `redis` без публичных портов в production.
- API для браузера идет по same-origin пути `/api/v1` через Next rewrites.
- NextAuth работает на домене `https://crm.example.com` с `trustHost`.

## Что важно

- В production не использовать `localhost` в `NEXTAUTH_URL`.
- `NEXTAUTH_SECRET` и `SECRET_KEY` должны быть постоянными (не менять между перезапусками).
- Рекомендуемый вход в приложение через NPM: `https://crm.example.com`.

## Файлы окружения

- Локально: `.env.example`
- Production: `.env.prod.example` -> скопировать в `.env` на VPS

Минимально обязательные переменные в `.env` на VPS:

- `ENVIRONMENT=production`
- `WEB_EXTERNAL_PORT=8080`
- `NEXTAUTH_URL=https://crm.example.com`
- `NEXTAUTH_SECRET=<длинный секрет>`
- `SECRET_KEY=<длинный секрет>`
- `API_INTERNAL_URL=http://api:8000`
- `API_PUBLIC_URL=https://crm.example.com/api`
- `NEXT_PUBLIC_API_URL=/api/v1`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `SEED_NETWORK_ADMIN_EMAIL`, `SEED_NETWORK_ADMIN_PASSWORD`
- `HEALTHCHECK_PORT=8080`

## Быстрый запуск на VPS

1. Клонирование:

```bash
sudo mkdir -p /opt/salon
sudo chown -R $USER:$USER /opt/salon
git clone <YOUR_REPO_URL> /opt/salon
cd /opt/salon
```

2. Подготовка env:

```bash
cp .env.prod.example .env
nano .env
```

3. Поднять production-стек:

```bash
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

4. Применить миграции:

```bash
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api alembic upgrade head
```

5. Seed admin (один раз):

```bash
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api python scripts/seed.py
```

## Настройка Nginx Proxy Manager

Создай Proxy Host:

- Domain Names: `crm.example.com`
- Scheme: `http`
- Forward Hostname/IP: `<VPS_IP>`
- Forward Port: `8080`
- Websockets Support: `ON`
- Block Common Exploits: `ON`

SSL:

- Request a new SSL Certificate
- Force SSL: `ON`
- HTTP/2 Support: `ON`

## Healthchecks и диагностика

Проверки на VPS:

```bash
curl -I http://localhost:8080/healthz
curl http://localhost:8080/api/v1/health
```

Ожидаемо:

- `/healthz` -> `200 ok`
- `/api/v1/health` -> `{"status":"ok"}`

Состояние контейнеров:

```bash
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Deploy/rollback/status

Скрипты:

- `scripts/deploy_server.sh`
- `scripts/rollback_server.sh`
- `scripts/status_server.sh`

Примеры:

```bash
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/deploy_server.sh --ref main
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/status_server.sh
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/rollback_server.sh --previous --no-migrations
```

## GitHub Actions (SSH deploy)

Workflow: `.github/workflows/deploy.yml`

Secrets:

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`
- `SERVER_APP_DIR`
- `SERVER_PORT`

Variables:

- `ENVIRONMENT=production`
- `HEALTHCHECK_PORT=8080`

## Типовые ошибки и решения

### 1) 500/503 на `/api/*`
- Проверь, что `NEXT_PUBLIC_API_URL=/api/v1`.
- Проверь rewrites в `apps/web/next.config.js`.
- Проверь `curl http://localhost:8080/api/v1/health`.

### 2) Infinite redirect / NextAuth config error
- Проверь `NEXTAUTH_URL=https://crm.example.com`.
- Проверь `NEXTAUTH_SECRET` (постоянный).
- Проверь `AUTH_TRUST_HOST=true`.

### 3) Логин проходит, но сессии нет
- Проверь, что вход идет по `https://crm.example.com`.
- Проверь корректный `NEXTAUTH_URL`.
- Очисти старые service workers/кэш браузера (в проекте SW отключен по умолчанию).

### 4) CORS ошибки
- В текущей схеме CORS не нужен для браузера (same-origin через `/api/v1`).
- Если вызываешь API с другого origin, заполни `CORS_ORIGINS`.

### 5) LetsEncrypt challenge fail в NPM
- Убедись, что домен резолвится на VPS.
- Открой 80/443 на сервере.
- Если Cloudflare, для выпуска временно переключи DNS в `DNS only`.

## Uploads

- Uploads хранятся в volume: `/var/app/uploads`.
- В репозитории runtime-файлы не коммитятся.

## Проверка "готово к работе"

Перед сдачей/запуском в проде:

1. `docker compose ps` -> все ключевые сервисы `Up` и health `healthy` где есть.
2. `curl -I http://localhost:8080/healthz` -> 200.
3. `curl http://localhost:8080/api/v1/health` -> ok.
4. `https://crm.example.com/crm/login` открывается.
5. Логин создает сессию и редиректит в `/crm`.
6. CRM страницы (`/crm`, `/staff`, `/client`) открываются без `HTTP 503`.
