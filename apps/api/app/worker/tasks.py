import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.future import select

from app.db.database import SessionLocal
from app.db.models import (
    Appointment,
    AppointmentStatusEnum,
    AppointmentStatusHistory,
    AuditLog,
    EventOutbox,
    Message,
    MessageChannelEnum,
    MessageStatusEnum,
    User,
)
from app.worker.celery_app import celery_app


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _append_note(existing: Optional[str], line: str) -> str:
    cleaned = (existing or "").strip()
    if not cleaned:
        return line
    return f"{cleaned}\n{line}"


async def _system_user_id(db) -> Optional[int]:
    user_res = await db.execute(select(User).order_by(User.id.asc()).limit(1))
    user = user_res.scalars().first()
    return user.id if user else None


async def _event_exists(db, *, event_type: str, appointment_id: int, marker: Optional[int] = None) -> bool:
    query = (
        select(EventOutbox.id)
        .where(EventOutbox.event_type == event_type)
        .where(EventOutbox.payload["appointment_id"].as_integer() == appointment_id)
    )
    if marker is not None:
        query = query.where(EventOutbox.payload["days_since_last_visit"].as_integer() == marker)

    result = await db.execute(query.limit(1))
    return result.scalars().first() is not None


async def _push_event(db, *, event_type: str, payload: dict) -> None:
    db.add(EventOutbox(event_type=event_type, payload=payload, processed=False))


async def _render_message(event: EventOutbox) -> Optional[dict]:
    payload = event.payload or {}
    salon_id = payload.get("salon_id")
    client_id = payload.get("client_id")
    if not salon_id or not client_id:
        return None

    event_type = event.event_type
    text = None

    if event_type == "APPOINTMENT_CREATED":
        otp = payload.get("otp_code", "------")
        text = f"Ваш запис створено. Код підтвердження: {otp}."
    elif event_type == "APPOINTMENT_RESCHEDULED":
        otp = payload.get("otp_code", "------")
        text = f"Ваш запис перенесено. Підтвердьте новий час кодом: {otp}."
    elif event_type == "APPOINTMENT_CONFIRMED":
        text = "Ваш запис підтверджено. Чекаємо на вас у салоні."
    elif event_type == "APPOINTMENT_CANCELED":
        reason = payload.get("reason", "client_request")
        text = f"Ваш запис скасовано. Причина: {reason}."
    elif event_type == "REMINDER_24H":
        text = "Нагадування: ваш візит через 24 години."
    elif event_type == "REMINDER_2H":
        text = "Нагадування: ваш візит через 2 години."
    elif event_type == "REVIEW_REQUEST":
        text = "Дякуємо за візит. Будемо вдячні за ваш відгук."
    elif event_type.startswith("REACTIVATION_"):
        days = payload.get("days_since_last_visit")
        text = f"Сумуємо за вами. З моменту останнього візиту минуло {days} днів."

    if not text:
        return None

    return {
        "salon_id": salon_id,
        "client_id": client_id,
        "channel": MessageChannelEnum.SMS,
        "content": text,
        "status": MessageStatusEnum.SENT,
        "provider_response": "simulated_by_worker",
    }


async def async_process_outbox() -> str:
    async with SessionLocal() as db:
        result = await db.execute(
            select(EventOutbox)
            .where(EventOutbox.processed.is_(False))
            .order_by(EventOutbox.id.asc())
            .limit(100)
        )
        events = result.scalars().all()

        processed = 0
        for event in events:
            message_payload = await _render_message(event)
            if message_payload:
                db.add(Message(**message_payload))

            event.processed = True
            processed += 1

        await db.commit()
        return f"Processed {processed} outbox event(s)"


async def async_expire_unconfirmed() -> str:
    async with SessionLocal() as db:
        now = _now()
        result = await db.execute(
            select(Appointment)
            .where(Appointment.status.in_([AppointmentStatusEnum.NEW, AppointmentStatusEnum.RESCHEDULED]))
            .where(Appointment.otp_expires_at.is_not(None))
            .where(Appointment.otp_expires_at < now)
        )
        appointments = result.scalars().all()
        actor_id = await _system_user_id(db)

        expired_count = 0
        for appt in appointments:
            reason = "expired_after_reschedule" if appt.status == AppointmentStatusEnum.RESCHEDULED else "expired_confirmation"
            appt.status = AppointmentStatusEnum.CANCELED
            appt.otp_code_hash = None
            appt.otp_expires_at = None
            appt.notes = _append_note(appt.notes, f"[AUTO_CANCELED: {reason}]")

            db.add(
                AppointmentStatusHistory(
                    appointment_id=appt.id,
                    salon_id=appt.salon_id,
                    status=AppointmentStatusEnum.CANCELED,
                    changed_by_user_id=actor_id,
                )
            )

            await _push_event(
                db,
                event_type="APPOINTMENT_CANCELED",
                payload={
                    "salon_id": appt.salon_id,
                    "appointment_id": appt.id,
                    "client_id": appt.client_id,
                    "reason": reason,
                },
            )

            if actor_id is not None:
                db.add(
                    AuditLog(
                        salon_id=appt.salon_id,
                        user_id=actor_id,
                        action="AUTO_CANCELED_EXPIRED_CONFIRMATION",
                        resource_type="appointment",
                        resource_id=appt.id,
                        details={"reason": reason, "source": "worker"},
                    )
                )

            expired_count += 1

        await db.commit()
        return f"Expired {expired_count} appointment(s)"


async def async_enqueue_communications() -> str:
    async with SessionLocal() as db:
        now = _now()
        created_events = 0

        # 24h and 2h reminders for confirmed appointments.
        confirmed_res = await db.execute(
            select(Appointment).where(Appointment.status == AppointmentStatusEnum.CONFIRMED)
        )
        confirmed = confirmed_res.scalars().all()

        for appt in confirmed:
            delta = appt.start_time - now

            if timedelta(hours=23, minutes=50) <= delta <= timedelta(hours=24, minutes=10):
                exists = await _event_exists(db, event_type="REMINDER_24H", appointment_id=appt.id)
                if not exists:
                    await _push_event(
                        db,
                        event_type="REMINDER_24H",
                        payload={
                            "salon_id": appt.salon_id,
                            "appointment_id": appt.id,
                            "client_id": appt.client_id,
                        },
                    )
                    created_events += 1

            if timedelta(hours=1, minutes=50) <= delta <= timedelta(hours=2, minutes=10):
                exists = await _event_exists(db, event_type="REMINDER_2H", appointment_id=appt.id)
                if not exists:
                    await _push_event(
                        db,
                        event_type="REMINDER_2H",
                        payload={
                            "salon_id": appt.salon_id,
                            "appointment_id": appt.id,
                            "client_id": appt.client_id,
                        },
                    )
                    created_events += 1

        # Review request around 1-3h after completed appointment.
        completed_res = await db.execute(
            select(Appointment).where(Appointment.status == AppointmentStatusEnum.COMPLETED)
        )
        completed = completed_res.scalars().all()

        for appt in completed:
            since_end = now - appt.end_time
            if timedelta(hours=1) <= since_end <= timedelta(hours=3):
                exists = await _event_exists(db, event_type="REVIEW_REQUEST", appointment_id=appt.id)
                if not exists:
                    await _push_event(
                        db,
                        event_type="REVIEW_REQUEST",
                        payload={
                            "salon_id": appt.salon_id,
                            "appointment_id": appt.id,
                            "client_id": appt.client_id,
                        },
                    )
                    created_events += 1

            # Reactivation at 45/60/90 days.
            days = (now - appt.end_time).days
            for milestone in (45, 60, 90):
                if milestone <= days <= milestone + 1:
                    event_type = f"REACTIVATION_{milestone}D"
                    exists = await _event_exists(
                        db,
                        event_type=event_type,
                        appointment_id=appt.id,
                        marker=milestone,
                    )
                    if not exists:
                        await _push_event(
                            db,
                            event_type=event_type,
                            payload={
                                "salon_id": appt.salon_id,
                                "appointment_id": appt.id,
                                "client_id": appt.client_id,
                                "days_since_last_visit": milestone,
                            },
                        )
                        created_events += 1

        await db.commit()
        return f"Queued {created_events} communication event(s)"


@celery_app.task(name="app.worker.tasks.process_outbox")
def process_outbox() -> str:
    return asyncio.run(async_process_outbox())


@celery_app.task(name="app.worker.tasks.expire_unconfirmed")
def expire_unconfirmed() -> str:
    return asyncio.run(async_expire_unconfirmed())


@celery_app.task(name="app.worker.tasks.enqueue_communications")
def enqueue_communications() -> str:
    return asyncio.run(async_enqueue_communications())
