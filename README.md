# SALON (Aesthetic Prime) Monorepo

Monorepo:
- `apps/api` - FastAPI + SQLAlchemy + Alembic
- `apps/web` - Next.js (App Router) + NextAuth
- `docker-compose.yml` - local/dev run
- `docker-compose.prod.yml` - production overrides
- `.github/workflows/deploy.yml` - deploy/rollback/status via SSH
- `scripts/deploy_server.sh` - deploy script
- `scripts/rollback_server.sh` - rollback script
- `scripts/status_server.sh` - status script

## Публикация на GitHub за 5 минут

1. Убедитесь, что заполнен только `.env.example`, а `.env` отсутствует.
2. Инициализируйте репозиторий и запушьте:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <URL_ВАШЕГО_REPO>
git push -u origin main
```

3. Короткий чеклист перед `git push`:
- не коммитить `.env`
- не коммитить `data/*`, `uploads/*`, `backups/*`
- не коммитить `apps/web/node_modules`, `apps/web/.next`
- не коммитить `__MACOSX`, `.DS_Store`, `*.log`, `*.tsbuildinfo`

Все это уже закрыто в `.gitignore`.

## Локальный запуск (dev)

```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm api alembic upgrade head
docker compose run --rm api python scripts/seed.py
```

Основные URL:
- `http://localhost:4000/`
- `http://localhost:4000/crm`
- `http://localhost:4000/staff`
- `http://localhost:4000/client`
- `http://localhost:4000/api/v1/health`

## Установка на сервер

Пример каталога: `/opt/salon`.

1. Установить Docker + Compose plugin на сервере.
2. Клонировать проект:

```bash
sudo mkdir -p /opt/salon
sudo chown -R $USER:$USER /opt/salon
git clone <URL_ВАШЕГО_REPO> /opt/salon
cd /opt/salon
```

3. Создать `.env` на сервере из шаблона:

```bash
cp .env.example .env
```

Обязательно задать в серверном `.env`:
- `ENVIRONMENT=production`
- `SECRET_KEY=<сильный_секрет_мин_32_символа>`
- `NEXTAUTH_SECRET=<сильный_секрет_мин_32_символа>`
- `NEXTAUTH_URL=https://<ваш-домен>`
- `NEXT_PUBLIC_APP_URL=https://<ваш-домен>`
- `NEXT_PUBLIC_API_URL=https://<ваш-домен>/api/v1`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `SEED_NETWORK_ADMIN_EMAIL`, `SEED_NETWORK_ADMIN_PASSWORD`

4. Первый запуск в production:

```bash
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api alembic upgrade head
```

5. Проверка:
- `curl -f http://localhost:4000/api/v1/health`
- открыть домен и `/crm/login`

6. Порты/домен:
- внешний HTTP(S) -> `nginx` контейнер (порт `4000` в текущем compose)
- для публичного домена обычно ставят reverse proxy/балансировщик перед сервером.

## GitHub Actions: обязательные секреты

В репозитории GitHub -> `Settings -> Secrets and variables -> Actions`:

Secrets:
- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`
- `SERVER_APP_DIR` (например `/opt/salon`)
- `SERVER_PORT` (обычно `22`)

Опциональные Variables:
- `ENVIRONMENT` (рекомендуется `production`)
- `HEALTHCHECK_PORT` (обычно `4000`)

## Деплой, статус, откат

### Автодеплой
- При `push` в `main` запускается `.github/workflows/deploy.yml`.
- Workflow подключается по SSH и вызывает `scripts/deploy_server.sh`.

### Ручной запуск workflow
`Actions -> Deploy To Server -> Run workflow` и выбрать:
- `action=deploy|rollback|status`
- `ref` (ветка/тег/commit)
- `rollback_to` (опционально для rollback)

### Ручные команды на сервере

Deploy:
```bash
cd /opt/salon
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/deploy_server.sh --ref main
```

Status:
```bash
cd /opt/salon
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/status_server.sh
```

Rollback на предыдущий релиз:
```bash
cd /opt/salon
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/rollback_server.sh --previous --no-migrations
```

Rollback на конкретный ref:
```bash
cd /opt/salon
APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/rollback_server.sh --to <ref> --no-migrations
```

### Если нужен ручной rollback через git

```bash
cd /opt/salon
git fetch --all --prune --tags
git reset --hard <commit_or_tag_or_branch>
ENVIRONMENT=production docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Что делает deploy_server.sh

- сохраняет текущее состояние в `.deploy/state.env`
- пишет историю в `.deploy/releases.log`
- делает backup БД в `backups/db/*.sql.gz` перед миграциями
- опционально делает backup uploads в `backups/uploads/*.tar.gz`
- поднимает контейнеры через prod-compose при `ENVIRONMENT=production`
- запускает `alembic upgrade head`
- выполняет health/smoke checks
- при провале делает auto-rollback на `PREVIOUS_REF`

## Политика миграций (важно)

- По умолчанию rollback не делает downgrade БД.
- Миграции должны быть backward-compatible минимум 1 релиз.
- Для destructive-изменений использовать 2-step подход:
1. сначала additive миграция + совместимый код
2. удаление старого только в следующем релизе

Восстановление БД из backup - только вручную в maintenance-окне.

## Runtime-данные

- `uploads/` - runtime данные (в репо только `.gitkeep`)
- `data/` - volume-данные БД/Redis (не коммитятся)
- `backups/` - локальные backup-файлы (не коммитятся)

## CRM ссылка на GitHub Actions

Для кнопки в CRM settings:
- переменная `NEXT_PUBLIC_GITHUB_ACTIONS_URL` в `.env`
- пример:
  `https://github.com/<org>/<repo>/actions/workflows/deploy.yml`

Не добавляйте в эту переменную токены и приватные параметры.
