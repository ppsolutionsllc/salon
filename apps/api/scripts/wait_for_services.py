import asyncio
import os
import sys

import asyncpg
from redis.asyncio import Redis


def _db_dsn() -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    if raw.startswith("postgresql+asyncpg://"):
        return raw.replace("postgresql+asyncpg://", "postgresql://", 1)
    return raw


async def wait_db(retries: int, delay: float) -> None:
    dsn = _db_dsn()
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")

    last_error: Exception | None = None
    for _ in range(retries):
        try:
            conn = await asyncpg.connect(dsn, timeout=5)
            try:
                await conn.execute("SELECT 1")
            finally:
                await conn.close()
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            await asyncio.sleep(delay)

    raise RuntimeError(f"DB is not reachable after {retries} retries: {last_error}")


async def wait_redis(retries: int, delay: float) -> None:
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        return

    client = Redis.from_url(redis_url)
    last_error: Exception | None = None
    for _ in range(retries):
        try:
            pong = await client.ping()
            if pong:
                await client.aclose()
                return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        await asyncio.sleep(delay)

    await client.aclose()
    raise RuntimeError(f"Redis is not reachable after {retries} retries: {last_error}")


async def main() -> None:
    retries = int(os.getenv("WAIT_FOR_SERVICES_RETRIES", "40"))
    delay = float(os.getenv("WAIT_FOR_SERVICES_DELAY", "2"))
    await wait_db(retries, delay)
    await wait_redis(retries, delay)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        raise
