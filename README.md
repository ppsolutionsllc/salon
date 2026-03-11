# SALON: FastAPI + Next.js + Postgres + Redis

Production-ready монорепозиторий для работы за Nginx Proxy Manager (NPM) без отдельного внутреннего nginx в основном сценарии.

## Архитектура (production)

- `web` (Next.js standalone) слушает `3000` в контейнере, наружу публикуется `8080`.
- `api` (FastAPI) и `worker` работают только во внутренней docker-сети.
- `db` и `redis` без публичных портов в production.
- API для браузера идет по same-origin пути `/api` через Next rewrites (`/api/*` -> FastAPI `/api/*`).
- NextAuth работает на домене `https://aestheticsprime.beauty` с `trustHost`.

## Что важно

- В production не использовать `localhost` в `AUTH_URL`.
- `AUTH_SECRET` и `SECRET_KEY` должны быть постоянными (не менять между перезапусками).
- Рекомендуемый вход в приложение через NPM: `https://aestheticsprime.beauty`.

## Файлы окружения

- Локально: `.env.example`
- Production: `.env.prod.example` -> скопировать в `.env` на VPS

Минимально обязательные переменные в `.env` на VPS:

- `ENVIRONMENT=production`
- `WEB_EXTERNAL_PORT=8080`
- `AUTH_URL=https://aestheticsprime.beauty`
- `AUTH_SECRET=<длинный секрет>`
- `SECRET_KEY=<длинный секрет>`
- `API_INTERNAL_URL=http://api:8000`
- `API_PUBLIC_URL=https://aestheticsprime.beauty/api`
- `NEXT_PUBLIC_API_URL=/api`
- `NEXT_PUBLIC_SITE_URL=https://aestheticsprime.beauty`
- `NEXTAUTH_URL=https://aestheticsprime.beauty` (legacy compat)
- `NEXTAUTH_SECRET=<тот же секрет>` (legacy compat)
- `TRUSTED_HOSTS=aestheticsprime.beauty,localhost,127.0.0.1,api`
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

- Domain Names: `aestheticsprime.beauty`
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
- Проверь, что `NEXT_PUBLIC_API_URL=/api`.
- Проверь rewrites в `apps/web/next.config.js`.
- Проверь `curl http://localhost:8080/api/v1/health`.
- В production `NEXT_PUBLIC_API_URL` принудительно фиксирован как `/api` в compose, чтобы браузер не ходил на `api:8000`.

### 2) Infinite redirect / NextAuth config error
- Проверь `AUTH_URL=https://aestheticsprime.beauty`.
- Проверь `AUTH_SECRET` (постоянный).
- Проверь `AUTH_TRUST_HOST=true`.
- Проверь, что `AUTH_SECRET` и `NEXTAUTH_SECRET` совпадают (для совместимости).
- Проверь, что NPM передает `X-Forwarded-Proto=https` (иначе secure-cookie/callback будут ломаться).

### 3) Логин проходит, но сессии нет
- Проверь, что вход идет по `https://aestheticsprime.beauty`.
- Проверь корректный `AUTH_URL`.
- Очисти старые service workers/кэш браузера (в проекте SW отключен по умолчанию).

### 4) CORS ошибки
- В текущей схеме CORS не нужен для браузера (same-origin через `/api`).
- Если вызываешь API с другого origin, заполни `CORS_ORIGINS`.

### 5) LetsEncrypt challenge fail в NPM
- Убедись, что домен резолвится на VPS.
- Открой 80/443 на сервере.
- Если Cloudflare, для выпуска временно переключи DNS в `DNS only`.

## Uploads

- Uploads хранятся в volume: `/var/app/uploads`.
- В репозитории runtime-файлы не коммитятся.

## Редактор сайту в CRM

Редактор доступен в CRM: `/crm/site/pages`.

### Ролі доступу

- `NETWORK_ADMIN`, `SALON_ADMIN`: повне редагування.
- `OPERATOR`: перегляд (read-only) за замовчуванням.
- `OPERATOR` можна дозволити редагуванням через ENV:
  - API: `SITE_EDITOR_OPERATOR_WRITE=true`
  - Web: `NEXT_PUBLIC_SITE_EDITOR_OPERATOR_WRITE=true`

### Multi-salon scope

- `salon_id=0` у CRM означає `Global` (мережевий контент, `salon_id = null` у БД).
- `salon_id>0` означає контент конкретного салону.
- Public read endpoint:
  - `GET /api/v1/public/site/{salon_id_or_global}/pages/{slug}`

### Draft / Publish / Versions / Rollback

- Збереження у редакторі створює нову версію (`page_versions`) і перемикає `draft_version_id`.
- Публікація: `published_version_id = draft_version_id`.
- Відкат: вибрана версія стає новою чернеткою.
- Історія версій: `/crm/site/pages/[id]/versions`.

### Preview

- Кнопка "Попередній перегляд" створює токен (TTL, hash у БД).
- Preview URL: `/preview/[slug]?token=...`
- API: `GET /api/v1/site/preview/{slug}?token=...`

### Медіа бібліотека

- CRM: `/crm/site/media`
- Upload: `POST /api/v1/salons/{salon_id}/media/upload`
- List: `GET /api/v1/salons/{salon_id}/media/list`
- Public file: `GET /api/v1/media/{id}`
- Private file: `GET /api/v1/private-media/{id}` (auth required)

### Як додати новий блок

1. Додай тип блоку в:
   - `apps/web/src/lib/site-editor/types.ts`
   - `apps/web/src/lib/site-editor/schema.ts`
2. Додай default-конфіг:
   - `apps/web/src/lib/site-editor/blocks.ts`
3. Додай рендер у:
   - `apps/web/src/components/site/page-renderer.tsx`
4. (Опційно) додай форму налаштувань у:
   - `apps/web/src/components/site/page-editor.tsx`
5. Переконайся, що тип додано в backend-валидацію:
   - `apps/api/app/api/v1/endpoints/site_editor.py`

## Проверка "готово к работе"

Перед сдачей/запуском в проде:

1. `docker compose ps` -> все ключевые сервисы `Up` и health `healthy` где есть.
2. `curl -I http://localhost:8080/healthz` -> 200.
3. `curl http://localhost:8080/api/v1/health` -> ok.
4. `https://aestheticsprime.beauty/crm/login` открывается.
5. Логин создает сессию и редиректит в `/crm`.
6. CRM страницы (`/crm`, `/staff`, `/client`) открываются без `HTTP 503`.

## Coolify (без NPM)

Если используешь Coolify для доменов, не поднимай отдельный NPM для этого же проекта.

1. В Coolify создай ресурс типа **Docker Compose** (не Dockerfile/Nixpacks).
2. Укажи compose-файл: `docker-compose.coolify.yaml` (или `docker-compose.coolify.yml`).
3. Добавь переменные окружения из `.env.prod.example`, минимум:
   `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `AUTH_URL`, `AUTH_SECRET`, `SECRET_KEY`.
4. Для домена `aestheticsprime.beauty` привяжи сервис `web` к порту `3000` в настройках Coolify.
5. После первого deploy выполни в терминале сервиса `api`:

```bash
alembic upgrade head
python scripts/seed.py
```

Если раньше запускался с другими `POSTGRES_*` и теперь база не стартует, удали старый volume Postgres в Coolify и задеплой заново.

Если выбрать в Coolify тип "Dockerfile", получишь ошибку `failed to read dockerfile: open Dockerfile: no such file or directory`, потому что Dockerfile в корне репозитория нет.
