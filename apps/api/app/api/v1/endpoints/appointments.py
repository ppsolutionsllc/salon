"""
Appointments endpoints for protected CRM/Staff/Client cabinet usage.
Includes:
- CRUD and slot engine
- OTP-based confirmation
- Reschedule with mandatory re-confirmation
- Outbox + audit hooks
"""
from datetime import date, datetime, timedelta, timezone
import random
import secrets
import string
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.security import get_password_hash, verify_password
from app.db.database import get_db
from app.db.models import (
    Appointment,
    AppointmentStatusEnum,
    AppointmentStatusHistory,
    AuditLog,
    Client,
    EventOutbox,
    Salon,
    Service,
    Staff,
    StaffWorkingHours,
    User,
)

router = APIRouter()


class AppointmentCreate(BaseModel):
    client_id: int
    staff_id: int
    service_id: int
    start_time: datetime
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    notes: Optional[str] = None
    start_time: Optional[datetime] = None


class AppointmentResponse(BaseModel):
    id: int
    salon_id: int
    client_id: int
    staff_id: int
    service_id: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatusEnum
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    client_name: Optional[str] = None
    staff_name: Optional[str] = None
    service_name: Optional[str] = None
    service_price: Optional[float] = None
    manage_token: Optional[str] = None
    otp_code: Optional[str] = None

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    status: AppointmentStatusEnum
    reason: Optional[str] = None


class ConfirmRequest(BaseModel):
    otp_code: str


class RescheduleRequest(BaseModel):
    new_start_time: datetime


class CancelRequest(BaseModel):
    reason: Optional[str] = "client_request"


class SlotRequest(BaseModel):
    staff_id: int
    service_id: int
    date: date


class SlotResponse(BaseModel):
    start_time: datetime
    end_time: datetime
    available: bool


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_manage_token() -> str:
    return secrets.token_urlsafe(24)


async def _record_audit(
    db: AsyncSession,
    *,
    salon_id: int,
    user_id: int,
    action: str,
    resource_type: str,
    resource_id: int,
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            salon_id=salon_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
        )
    )


async def _enrich(db: AsyncSession, appt: Appointment) -> AppointmentResponse:
    client_name = None
    staff_name = None
    service_name = None
    service_price = None

    client_res = await db.execute(select(Client).where(Client.id == appt.client_id))
    client = client_res.scalars().first()
    if client:
        client_name = f"{client.first_name} {client.last_name or ''}".strip()

    staff_res = await db.execute(select(Staff).where(Staff.id == appt.staff_id))
    staff = staff_res.scalars().first()
    if staff:
        staff_name = f"{staff.first_name} {staff.last_name}".strip()

    service_res = await db.execute(select(Service).where(Service.id == appt.service_id))
    service = service_res.scalars().first()
    if service:
        service_name = service.name
        service_price = service.price

    return AppointmentResponse(
        id=appt.id,
        salon_id=appt.salon_id,
        client_id=appt.client_id,
        staff_id=appt.staff_id,
        service_id=appt.service_id,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        notes=appt.notes,
        created_at=appt.created_at,
        client_name=client_name,
        staff_name=staff_name,
        service_name=service_name,
        service_price=service_price,
        manage_token=appt.manage_token,
    )


async def _check_overlap(
    db: AsyncSession,
    *,
    staff_id: int,
    start_at: datetime,
    end_at: datetime,
    exclude_id: Optional[int] = None,
) -> Optional[Appointment]:
    query = (
        select(Appointment)
        .where(Appointment.staff_id == staff_id)
        .where(Appointment.status.notin_([AppointmentStatusEnum.CANCELED]))
        .where(Appointment.start_time < end_at)
        .where(Appointment.end_time > start_at)
    )
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)

    result = await db.execute(query)
    return result.scalars().first()


async def _record_history(
    db: AsyncSession,
    *,
    appt: Appointment,
    status: AppointmentStatusEnum,
    user_id: Optional[int],
) -> None:
    db.add(
        AppointmentStatusHistory(
            appointment_id=appt.id,
            salon_id=appt.salon_id,
            status=status,
            changed_by_user_id=user_id,
        )
    )


async def _push_outbox(db: AsyncSession, *, event_type: str, payload: dict) -> None:
    db.add(EventOutbox(event_type=event_type, payload=payload, processed=False))


def _set_otp(appt: Appointment, ttl_minutes: int) -> str:
    otp_plain = generate_otp()
    appt.otp_code_hash = get_password_hash(otp_plain)
    appt.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    if not appt.manage_token:
        appt.manage_token = generate_manage_token()
    return otp_plain


def _append_note(existing: Optional[str], line: str) -> str:
    cleaned = (existing or "").strip()
    if not cleaned:
        return line
    return f"{cleaned}\n{line}"


async def _load_service_in_salon(db: AsyncSession, *, salon_id: int, service_id: int) -> Service:
    res = await db.execute(
        select(Service).where(Service.id == service_id, Service.salon_id == salon_id)
    )
    service = res.scalars().first()
    if not service:
        raise HTTPException(404, "Послугу не знайдено")
    return service


async def _load_staff_in_salon(db: AsyncSession, *, salon_id: int, staff_id: int) -> Staff:
    res = await db.execute(select(Staff).where(Staff.id == staff_id, Staff.salon_id == salon_id))
    staff = res.scalars().first()
    if not staff:
        raise HTTPException(404, "Майстра не знайдено")
    return staff


async def _load_client_in_salon(db: AsyncSession, *, salon_id: int, client_id: int) -> Client:
    res = await db.execute(select(Client).where(Client.id == client_id, Client.salon_id == salon_id))
    client = res.scalars().first()
    if not client:
        raise HTTPException(404, "Клієнта не знайдено")
    return client


@router.post("/{salon_id}/appointments/slots", response_model=List[SlotResponse])
async def get_available_slots(
    salon_id: int,
    req: SlotRequest,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
) -> Any:
    service = await _load_service_in_salon(db, salon_id=salon_id, service_id=req.service_id)
    await _load_staff_in_salon(db, salon_id=salon_id, staff_id=req.staff_id)

    duration = service.duration_minutes
    buffer_before = service.buffer_before or 0
    buffer_after = service.buffer_after or 0

    day_of_week = req.date.weekday()
    wh_res = await db.execute(
        select(StaffWorkingHours)
        .where(StaffWorkingHours.staff_id == req.staff_id)
        .where(StaffWorkingHours.salon_id == salon_id)
        .where(StaffWorkingHours.day_of_week == day_of_week)
        .where(StaffWorkingHours.is_working.is_(True))
    )
    working_hours = wh_res.scalars().first()
    if not working_hours:
        return []

    start_h, start_m = (int(x) for x in working_hours.start_time.split(":"))
    end_h, end_m = (int(x) for x in working_hours.end_time.split(":"))

    day_start = datetime(req.date.year, req.date.month, req.date.day, start_h, start_m, tzinfo=timezone.utc)
    day_end = datetime(req.date.year, req.date.month, req.date.day, end_h, end_m, tzinfo=timezone.utc)

    existing_res = await db.execute(
        select(Appointment)
        .where(Appointment.salon_id == salon_id)
        .where(Appointment.staff_id == req.staff_id)
        .where(Appointment.status.notin_([AppointmentStatusEnum.CANCELED]))
        .where(Appointment.start_time >= day_start)
        .where(Appointment.start_time < day_end)
    )
    existing = existing_res.scalars().all()

    slots: List[SlotResponse] = []
    slot_cursor = day_start
    now = datetime.now(timezone.utc)

    while slot_cursor + timedelta(minutes=buffer_before + duration + buffer_after) <= day_end:
        effective_start = slot_cursor + timedelta(minutes=buffer_before)
        effective_end = effective_start + timedelta(minutes=duration)
        slot_end = effective_end + timedelta(minutes=buffer_after)

        available = effective_start >= now
        if available:
            for booked in existing:
                if booked.start_time < slot_end and booked.end_time > slot_cursor:
                    available = False
                    break

        slots.append(
            SlotResponse(
                start_time=effective_start,
                end_time=effective_end,
                available=available,
            )
        )

        slot_cursor += timedelta(minutes=15)

    return slots


@router.get("/{salon_id}/appointments", response_model=List[AppointmentResponse])
async def read_appointments(
    salon_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    staff_id: Optional[int] = None,
    client_id: Optional[int] = None,
    status: Optional[AppointmentStatusEnum] = None,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
) -> Any:
    query = select(Appointment).where(Appointment.salon_id == salon_id)

    if start_date:
        query = query.where(Appointment.start_time >= _to_utc(start_date))
    if end_date:
        query = query.where(Appointment.end_time <= _to_utc(end_date))
    if staff_id:
        query = query.where(Appointment.staff_id == staff_id)
    if client_id:
        query = query.where(Appointment.client_id == client_id)
    if status:
        query = query.where(Appointment.status == status)

    query = query.order_by(Appointment.start_time.desc())

    result = await db.execute(query)
    appointments = result.scalars().all()
    return [await _enrich(db, item) for item in appointments]


@router.post("/{salon_id}/appointments", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    salon_id: int,
    appt_in: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    service = await _load_service_in_salon(db, salon_id=salon_id, service_id=appt_in.service_id)
    await _load_staff_in_salon(db, salon_id=salon_id, staff_id=appt_in.staff_id)
    await _load_client_in_salon(db, salon_id=salon_id, client_id=appt_in.client_id)

    start_at = _to_utc(appt_in.start_time)
    if start_at <= datetime.now(timezone.utc):
        raise HTTPException(400, "Не можна створити запис у минулому")

    end_at = start_at + timedelta(minutes=service.duration_minutes)

    overlap = await _check_overlap(
        db,
        staff_id=appt_in.staff_id,
        start_at=start_at,
        end_at=end_at,
    )
    if overlap:
        raise HTTPException(400, "Майстер зайнятий у цей час")

    appointment = Appointment(
        salon_id=salon_id,
        client_id=appt_in.client_id,
        staff_id=appt_in.staff_id,
        service_id=appt_in.service_id,
        start_time=start_at,
        end_time=end_at,
        status=AppointmentStatusEnum.NEW,
        notes=appt_in.notes,
        manage_token=generate_manage_token(),
    )

    otp_plain = _set_otp(appointment, ttl_minutes=30)
    db.add(appointment)
    await db.flush()

    await _record_history(db, appt=appointment, status=AppointmentStatusEnum.NEW, user_id=current_user.id)
    await _record_audit(
        db,
        salon_id=salon_id,
        user_id=current_user.id,
        action="APPOINTMENT_CREATED",
        resource_type="appointment",
        resource_id=appointment.id,
        details={"status": "NEW", "source": "protected_api"},
    )
    await _push_outbox(
        db,
        event_type="APPOINTMENT_CREATED",
        payload={
            "salon_id": salon_id,
            "appointment_id": appointment.id,
            "client_id": appointment.client_id,
            "otp_code": otp_plain,
            "confirmation_ttl_minutes": 30,
            "manage_token": appointment.manage_token,
        },
    )

    await db.commit()
    await db.refresh(appointment)
    response = await _enrich(db, appointment)
    response.otp_code = otp_plain
    return response


@router.get("/{salon_id}/appointments/{appt_id}", response_model=AppointmentResponse)
async def get_appointment(
    salon_id: int,
    appt_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
) -> Any:
    res = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.salon_id == salon_id)
    )
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(404, "Запис не знайдено")
    return await _enrich(db, appt)


@router.post("/{salon_id}/appointments/{appt_id}/confirm", response_model=AppointmentResponse)
async def confirm_appointment(
    salon_id: int,
    appt_id: int,
    req: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    res = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.salon_id == salon_id)
    )
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(404, "Запис не знайдено")

    if appt.status not in [AppointmentStatusEnum.NEW, AppointmentStatusEnum.RESCHEDULED]:
        raise HTTPException(400, f"Не можна підтвердити запис у статусі {appt.status}")

    if not appt.otp_code_hash or not appt.otp_expires_at:
        raise HTTPException(400, "Для цього запису не налаштовано OTP")

    if datetime.now(timezone.utc) > _to_utc(appt.otp_expires_at):
        raise HTTPException(400, "Код підтвердження прострочений")

    if not verify_password(req.otp_code, appt.otp_code_hash):
        raise HTTPException(400, "Невірний код підтвердження")

    appt.status = AppointmentStatusEnum.CONFIRMED
    appt.otp_code_hash = None
    appt.otp_expires_at = None

    await _record_history(db, appt=appt, status=AppointmentStatusEnum.CONFIRMED, user_id=current_user.id)
    await _record_audit(
        db,
        salon_id=salon_id,
        user_id=current_user.id,
        action="APPOINTMENT_CONFIRMED",
        resource_type="appointment",
        resource_id=appt.id,
        details={"source": "protected_api"},
    )
    await _push_outbox(
        db,
        event_type="APPOINTMENT_CONFIRMED",
        payload={
            "salon_id": salon_id,
            "appointment_id": appt.id,
            "client_id": appt.client_id,
        },
    )

    await db.commit()
    await db.refresh(appt)
    return await _enrich(db, appt)


@router.post("/{salon_id}/appointments/{appt_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    salon_id: int,
    appt_id: int,
    req: CancelRequest,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    res = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.salon_id == salon_id)
    )
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(404, "Запис не знайдено")

    if appt.status in [AppointmentStatusEnum.CANCELED, AppointmentStatusEnum.COMPLETED]:
        raise HTTPException(400, f"Не можна скасувати запис у статусі {appt.status}")

    appt.status = AppointmentStatusEnum.CANCELED
    appt.otp_code_hash = None
    appt.otp_expires_at = None
    appt.notes = _append_note(appt.notes, f"[Причина скасування: {req.reason or 'client_request'}]")

    await _record_history(db, appt=appt, status=AppointmentStatusEnum.CANCELED, user_id=current_user.id)
    await _record_audit(
        db,
        salon_id=salon_id,
        user_id=current_user.id,
        action="APPOINTMENT_CANCELED",
        resource_type="appointment",
        resource_id=appt.id,
        details={"reason": req.reason or "client_request", "source": "protected_api"},
    )
    await _push_outbox(
        db,
        event_type="APPOINTMENT_CANCELED",
        payload={
            "salon_id": salon_id,
            "appointment_id": appt.id,
            "client_id": appt.client_id,
            "reason": req.reason or "client_request",
        },
    )

    await db.commit()
    await db.refresh(appt)
    return await _enrich(db, appt)


@router.post("/{salon_id}/appointments/{appt_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    salon_id: int,
    appt_id: int,
    req: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    res = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.salon_id == salon_id)
    )
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(404, "Запис не знайдено")

    if appt.status in [AppointmentStatusEnum.CANCELED, AppointmentStatusEnum.COMPLETED]:
        raise HTTPException(400, f"Не можна перенести запис у статусі {appt.status}")

    service = await _load_service_in_salon(db, salon_id=salon_id, service_id=appt.service_id)

    new_start = _to_utc(req.new_start_time)
    if new_start <= datetime.now(timezone.utc):
        raise HTTPException(400, "Не можна переносити запис у минуле")

    new_end = new_start + timedelta(minutes=service.duration_minutes)

    overlap = await _check_overlap(
        db,
        staff_id=appt.staff_id,
        start_at=new_start,
        end_at=new_end,
        exclude_id=appt.id,
    )
    if overlap:
        raise HTTPException(400, "Майстер зайнятий у новий час")

    old_start = appt.start_time
    old_end = appt.end_time

    appt.start_time = new_start
    appt.end_time = new_end
    appt.status = AppointmentStatusEnum.RESCHEDULED
    otp_plain = _set_otp(appt, ttl_minutes=120)
    appt.notes = _append_note(
        appt.notes,
        f"[Перенесено з {old_start.strftime('%d.%m %H:%M')} на {new_start.strftime('%d.%m %H:%M')}]",
    )

    await _record_history(db, appt=appt, status=AppointmentStatusEnum.RESCHEDULED, user_id=current_user.id)
    await _record_audit(
        db,
        salon_id=salon_id,
        user_id=current_user.id,
        action="APPOINTMENT_RESCHEDULED",
        resource_type="appointment",
        resource_id=appt.id,
        details={
            "old_start": old_start.isoformat(),
            "new_start": new_start.isoformat(),
            "source": "protected_api",
        },
    )
    await _push_outbox(
        db,
        event_type="APPOINTMENT_RESCHEDULED",
        payload={
            "salon_id": salon_id,
            "appointment_id": appt.id,
            "client_id": appt.client_id,
            "old_start_at": old_start.isoformat(),
            "old_end_at": old_end.isoformat(),
            "new_start_at": new_start.isoformat(),
            "new_end_at": new_end.isoformat(),
            "otp_code": otp_plain,
            "reconfirm_ttl_minutes": 120,
            "manage_token": appt.manage_token,
        },
    )

    await db.commit()
    await db.refresh(appt)
    response = await _enrich(db, appt)
    response.otp_code = otp_plain
    return response


@router.post("/{salon_id}/appointments/{appt_id}/status", response_model=AppointmentResponse)
async def change_appointment_status(
    salon_id: int,
    appt_id: int,
    req: StatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    res = await db.execute(
        select(Appointment).where(Appointment.id == appt_id, Appointment.salon_id == salon_id)
    )
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(404, "Запис не знайдено")

    transitions = {
        AppointmentStatusEnum.NEW: [AppointmentStatusEnum.CONFIRMED, AppointmentStatusEnum.CANCELED],
        AppointmentStatusEnum.CONFIRMED: [
            AppointmentStatusEnum.COMPLETED,
            AppointmentStatusEnum.NO_SHOW,
            AppointmentStatusEnum.CANCELED,
            AppointmentStatusEnum.RESCHEDULED,
        ],
        AppointmentStatusEnum.RESCHEDULED: [AppointmentStatusEnum.CONFIRMED, AppointmentStatusEnum.CANCELED],
    }

    allowed = transitions.get(appt.status, [])
    if req.status not in allowed:
        raise HTTPException(400, f"Недозволений перехід: {appt.status} -> {req.status}")

    appt.status = req.status
    if req.reason:
        appt.notes = _append_note(appt.notes, f"[{req.status}: {req.reason}]")

    if req.status == AppointmentStatusEnum.CONFIRMED:
        appt.otp_code_hash = None
        appt.otp_expires_at = None

    await _record_history(db, appt=appt, status=req.status, user_id=current_user.id)
    await _record_audit(
        db,
        salon_id=salon_id,
        user_id=current_user.id,
        action=f"APPOINTMENT_{req.status}",
        resource_type="appointment",
        resource_id=appt.id,
        details={"reason": req.reason, "source": "protected_api"},
    )
    await _push_outbox(
        db,
        event_type=f"APPOINTMENT_{req.status}",
        payload={
            "salon_id": salon_id,
            "appointment_id": appt.id,
            "client_id": appt.client_id,
            "reason": req.reason,
        },
    )

    await db.commit()
    await db.refresh(appt)
    return await _enrich(db, appt)
