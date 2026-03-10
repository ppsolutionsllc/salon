from datetime import date, datetime, timedelta, timezone
import random
import secrets
import string
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import get_password_hash, verify_password
from app.db.database import SessionLocal
from app.db.models import (
    Appointment,
    AppointmentStatusEnum,
    AppointmentStatusHistory,
    AuditLog,
    Client,
    EventOutbox,
    RoleEnum,
    Salon,
    Service,
    Staff,
    StaffService,
    StaffWorkingHours,
    User,
)

router = APIRouter()


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _manage_token() -> str:
    return secrets.token_urlsafe(24)


def _append_note(existing: Optional[str], line: str) -> str:
    cleaned = (existing or "").strip()
    if not cleaned:
        return line
    return f"{cleaned}\n{line}"


class PublicSalonResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    timezone: str


class PublicServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    category_id: Optional[int] = None


class PublicStaffResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: Optional[str] = None


class PublicSlotRequest(BaseModel):
    service_id: int
    date: date
    staff_id: Optional[int] = None


class PublicSlotResponse(BaseModel):
    staff_id: int
    staff_name: str
    start_time: datetime
    end_time: datetime
    available: bool


class PublicBookingCreateRequest(BaseModel):
    salon_id: int
    service_id: int
    staff_id: Optional[int] = None
    start_time: datetime
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None


class PublicBookingCreatedResponse(BaseModel):
    booking_id: int
    status: AppointmentStatusEnum
    salon_id: int
    otp_expires_at: datetime
    manage_token: str
    confirm_url: str
    cancel_url: str
    reschedule_url: str
    otp_code_dev: Optional[str] = None


class PublicConfirmRequest(BaseModel):
    otp_code: str


class PublicCancelRequest(BaseModel):
    reason: Optional[str] = "client_request"


class PublicRescheduleRequest(BaseModel):
    new_start_time: datetime


class PublicBookingDetails(BaseModel):
    booking_id: int
    salon_id: int
    salon_name: str
    service_name: str
    staff_name: str
    client_name: str
    client_phone: str
    start_time: datetime
    end_time: datetime
    status: AppointmentStatusEnum
    notes: Optional[str] = None
    manage_token: str
    otp_expires_at: Optional[datetime] = None


async def _system_user_id(db: AsyncSession) -> Optional[int]:
    network_admin = await db.execute(
        select(User).where(User.global_role == RoleEnum.NETWORK_ADMIN).order_by(User.id.asc()).limit(1)
    )
    admin = network_admin.scalars().first()
    if admin:
        return admin.id

    any_user = await db.execute(select(User).order_by(User.id.asc()).limit(1))
    user = any_user.scalars().first()
    return user.id if user else None


async def _audit_public(
    db: AsyncSession,
    *,
    salon_id: int,
    action: str,
    resource_id: int,
    details: Optional[dict] = None,
) -> None:
    actor_id = await _system_user_id(db)
    if actor_id is None:
        return

    db.add(
        AuditLog(
            salon_id=salon_id,
            user_id=actor_id,
            action=action,
            resource_type="appointment",
            resource_id=resource_id,
            details={"source": "public_api", **(details or {})},
        )
    )


async def _push_outbox(db: AsyncSession, *, event_type: str, payload: dict) -> None:
    db.add(EventOutbox(event_type=event_type, payload=payload, processed=False))


async def _get_salon_or_404(db: AsyncSession, salon_id: int) -> Salon:
    result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = result.scalars().first()
    if not salon:
        raise HTTPException(404, "Салон не знайдено")
    return salon


async def _get_service_or_404(db: AsyncSession, salon_id: int, service_id: int) -> Service:
    result = await db.execute(
        select(Service).where(Service.id == service_id, Service.salon_id == salon_id)
    )
    service = result.scalars().first()
    if not service:
        raise HTTPException(404, "Послугу не знайдено")
    return service


async def _get_staff_or_404(db: AsyncSession, salon_id: int, staff_id: int) -> Staff:
    result = await db.execute(select(Staff).where(Staff.id == staff_id, Staff.salon_id == salon_id))
    staff = result.scalars().first()
    if not staff:
        raise HTTPException(404, "Майстра не знайдено")
    return staff


async def _staff_for_service(db: AsyncSession, salon_id: int, service_id: int) -> List[Staff]:
    result = await db.execute(
        select(Staff)
        .join(StaffService, StaffService.staff_id == Staff.id)
        .where(Staff.salon_id == salon_id, StaffService.service_id == service_id)
        .order_by(Staff.id.asc())
    )
    return list(result.scalars().all())


async def _upsert_public_client(
    db: AsyncSession,
    *,
    salon_id: int,
    first_name: str,
    last_name: Optional[str],
    phone: str,
    email: Optional[str],
) -> Client:
    existing_res = await db.execute(
        select(Client).where(Client.salon_id == salon_id, Client.phone == phone)
    )
    client = existing_res.scalars().first()
    if client:
        client.first_name = first_name
        client.last_name = last_name
        client.email = email
        return client

    client = Client(
        salon_id=salon_id,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        email=email,
    )
    db.add(client)
    await db.flush()
    return client


async def _check_overlap(
    db: AsyncSession,
    *,
    staff_id: int,
    start_at: datetime,
    end_at: datetime,
    exclude_appt_id: Optional[int] = None,
) -> Optional[Appointment]:
    query = (
        select(Appointment)
        .where(Appointment.staff_id == staff_id)
        .where(Appointment.status.notin_([AppointmentStatusEnum.CANCELED]))
        .where(Appointment.start_time < end_at)
        .where(Appointment.end_time > start_at)
    )
    if exclude_appt_id:
        query = query.where(Appointment.id != exclude_appt_id)

    result = await db.execute(query)
    return result.scalars().first()


async def _record_history(
    db: AsyncSession,
    *,
    appointment: Appointment,
    status: AppointmentStatusEnum,
) -> None:
    actor_id = await _system_user_id(db)
    db.add(
        AppointmentStatusHistory(
            appointment_id=appointment.id,
            salon_id=appointment.salon_id,
            status=status,
            changed_by_user_id=actor_id,
        )
    )


async def _appointment_details(db: AsyncSession, appointment: Appointment) -> PublicBookingDetails:
    salon_res = await db.execute(select(Salon).where(Salon.id == appointment.salon_id))
    salon = salon_res.scalars().first()
    service_res = await db.execute(select(Service).where(Service.id == appointment.service_id))
    service = service_res.scalars().first()
    staff_res = await db.execute(select(Staff).where(Staff.id == appointment.staff_id))
    staff = staff_res.scalars().first()
    client_res = await db.execute(select(Client).where(Client.id == appointment.client_id))
    client = client_res.scalars().first()

    return PublicBookingDetails(
        booking_id=appointment.id,
        salon_id=appointment.salon_id,
        salon_name=salon.name if salon else "",
        service_name=service.name if service else "",
        staff_name=f"{staff.first_name} {staff.last_name}".strip() if staff else "",
        client_name=f"{client.first_name} {client.last_name or ''}".strip() if client else "",
        client_phone=client.phone if client else "",
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status,
        notes=appointment.notes,
        manage_token=appointment.manage_token or "",
        otp_expires_at=appointment.otp_expires_at,
    )


async def _staff_day_slots(
    db: AsyncSession,
    *,
    salon_id: int,
    staff: Staff,
    service: Service,
    target_date: date,
) -> List[PublicSlotResponse]:
    day_of_week = target_date.weekday()

    wh_res = await db.execute(
        select(StaffWorkingHours)
        .where(StaffWorkingHours.staff_id == staff.id)
        .where(StaffWorkingHours.salon_id == salon_id)
        .where(StaffWorkingHours.day_of_week == day_of_week)
        .where(StaffWorkingHours.is_working.is_(True))
    )
    wh = wh_res.scalars().first()
    if not wh:
        return []

    start_h, start_m = (int(x) for x in wh.start_time.split(":"))
    end_h, end_m = (int(x) for x in wh.end_time.split(":"))

    day_start = datetime(target_date.year, target_date.month, target_date.day, start_h, start_m, tzinfo=timezone.utc)
    day_end = datetime(target_date.year, target_date.month, target_date.day, end_h, end_m, tzinfo=timezone.utc)

    booked_res = await db.execute(
        select(Appointment)
        .where(Appointment.salon_id == salon_id)
        .where(Appointment.staff_id == staff.id)
        .where(Appointment.status.notin_([AppointmentStatusEnum.CANCELED]))
        .where(Appointment.start_time >= day_start)
        .where(Appointment.start_time < day_end)
    )
    booked = booked_res.scalars().all()

    duration = service.duration_minutes
    buffer_before = service.buffer_before or 0
    buffer_after = service.buffer_after or 0

    cursor = day_start
    now = _now()
    slots: List[PublicSlotResponse] = []

    while cursor + timedelta(minutes=buffer_before + duration + buffer_after) <= day_end:
        start_time = cursor + timedelta(minutes=buffer_before)
        end_time = start_time + timedelta(minutes=duration)
        busy_block_end = end_time + timedelta(minutes=buffer_after)

        available = start_time >= now
        if available:
            for item in booked:
                if item.start_time < busy_block_end and item.end_time > cursor:
                    available = False
                    break

        slots.append(
            PublicSlotResponse(
                staff_id=staff.id,
                staff_name=f"{staff.first_name} {staff.last_name}".strip(),
                start_time=start_time,
                end_time=end_time,
                available=available,
            )
        )

        cursor += timedelta(minutes=15)

    return slots


@router.get("/salons", response_model=List[PublicSalonResponse])
async def get_public_salons() -> Any:
    async with SessionLocal() as db:
        result = await db.execute(select(Salon).order_by(Salon.id.asc()))
        salons = result.scalars().all()
        return [
            PublicSalonResponse(id=s.id, name=s.name, address=s.address, timezone=s.timezone)
            for s in salons
        ]


@router.get("/salons/{salon_id}", response_model=PublicSalonResponse)
async def get_public_salon(salon_id: int) -> Any:
    async with SessionLocal() as db:
        salon = await _get_salon_or_404(db, salon_id)
        return PublicSalonResponse(id=salon.id, name=salon.name, address=salon.address, timezone=salon.timezone)


@router.get("/salons/{salon_id}/services", response_model=List[PublicServiceResponse])
async def get_public_services(salon_id: int) -> Any:
    async with SessionLocal() as db:
        await _get_salon_or_404(db, salon_id)
        result = await db.execute(
            select(Service)
            .where(Service.salon_id == salon_id)
            .order_by(Service.price.asc(), Service.id.asc())
        )
        services = result.scalars().all()
        return [
            PublicServiceResponse(
                id=s.id,
                name=s.name,
                description=s.description,
                duration_minutes=s.duration_minutes,
                price=s.price,
                category_id=s.category_id,
            )
            for s in services
        ]


@router.get("/salons/{salon_id}/staff", response_model=List[PublicStaffResponse])
async def get_public_staff(salon_id: int, service_id: Optional[int] = None) -> Any:
    async with SessionLocal() as db:
        await _get_salon_or_404(db, salon_id)

        if service_id:
            staff_list = await _staff_for_service(db, salon_id, service_id)
        else:
            result = await db.execute(select(Staff).where(Staff.salon_id == salon_id).order_by(Staff.id.asc()))
            staff_list = list(result.scalars().all())

        return [
            PublicStaffResponse(
                id=s.id,
                first_name=s.first_name,
                last_name=s.last_name,
                phone=s.phone,
            )
            for s in staff_list
        ]


@router.post("/salons/{salon_id}/slots", response_model=List[PublicSlotResponse])
async def get_public_slots(salon_id: int, req: PublicSlotRequest) -> Any:
    async with SessionLocal() as db:
        await _get_salon_or_404(db, salon_id)
        service = await _get_service_or_404(db, salon_id, req.service_id)

        if req.staff_id:
            staff = await _get_staff_or_404(db, salon_id, req.staff_id)
            slots = await _staff_day_slots(db, salon_id=salon_id, staff=staff, service=service, target_date=req.date)
            return [s for s in slots if s.available]

        staff_pool = await _staff_for_service(db, salon_id, req.service_id)
        all_slots: List[PublicSlotResponse] = []
        for staff in staff_pool:
            all_slots.extend(
                await _staff_day_slots(db, salon_id=salon_id, staff=staff, service=service, target_date=req.date)
            )

        # Keep only available and unique by exact datetime (choose first staff per slot)
        available = [item for item in all_slots if item.available]
        available.sort(key=lambda x: x.start_time)

        by_start: dict[str, PublicSlotResponse] = {}
        for slot in available:
            key = slot.start_time.isoformat()
            if key not in by_start:
                by_start[key] = slot

        return list(by_start.values())


@router.post("/bookings", response_model=PublicBookingCreatedResponse, status_code=201)
async def create_public_booking(req: PublicBookingCreateRequest) -> Any:
    async with SessionLocal() as db:
        salon = await _get_salon_or_404(db, req.salon_id)
        service = await _get_service_or_404(db, req.salon_id, req.service_id)

        chosen_staff: Optional[Staff] = None
        if req.staff_id:
            chosen_staff = await _get_staff_or_404(db, req.salon_id, req.staff_id)
        else:
            staff_pool = await _staff_for_service(db, req.salon_id, req.service_id)
            if not staff_pool:
                raise HTTPException(400, "Для послуги не знайдено майстра")
            chosen_staff = staff_pool[0]

        start_at = _to_utc(req.start_time)
        if start_at <= _now():
            raise HTTPException(400, "Неможливо записатись у минуле")

        end_at = start_at + timedelta(minutes=service.duration_minutes)
        overlap = await _check_overlap(
            db,
            staff_id=chosen_staff.id,
            start_at=start_at,
            end_at=end_at,
        )
        if overlap:
            raise HTTPException(400, "Обраний слот вже зайнятий")

        client = await _upsert_public_client(
            db,
            salon_id=req.salon_id,
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            email=req.email,
        )

        appointment = Appointment(
            salon_id=req.salon_id,
            client_id=client.id,
            staff_id=chosen_staff.id,
            service_id=req.service_id,
            start_time=start_at,
            end_time=end_at,
            status=AppointmentStatusEnum.NEW,
            notes=req.notes,
            manage_token=_manage_token(),
        )

        otp_plain = _otp()
        appointment.otp_code_hash = get_password_hash(otp_plain)
        appointment.otp_expires_at = _now() + timedelta(minutes=30)

        db.add(appointment)
        await db.flush()

        await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.NEW)
        await _audit_public(
            db,
            salon_id=req.salon_id,
            action="PUBLIC_APPOINTMENT_CREATED",
            resource_id=appointment.id,
            details={"client_phone": req.phone},
        )
        await _push_outbox(
            db,
            event_type="APPOINTMENT_CREATED",
            payload={
                "salon_id": req.salon_id,
                "appointment_id": appointment.id,
                "client_id": client.id,
                "otp_code": otp_plain,
                "confirmation_ttl_minutes": 30,
                "manage_token": appointment.manage_token,
            },
        )

        await db.commit()

        return PublicBookingCreatedResponse(
            booking_id=appointment.id,
            status=appointment.status,
            salon_id=req.salon_id,
            otp_expires_at=appointment.otp_expires_at,
            manage_token=appointment.manage_token,
            confirm_url=f"/zapys?booking={appointment.id}&step=confirm",
            cancel_url=f"/zapys/manage/{appointment.manage_token}?action=cancel",
            reschedule_url=f"/zapys/manage/{appointment.manage_token}?action=reschedule",
            otp_code_dev=otp_plain,
        )


@router.post("/bookings/{booking_id}/confirm", response_model=PublicBookingDetails)
async def confirm_public_booking(booking_id: int, req: PublicConfirmRequest) -> Any:
    async with SessionLocal() as db:
        result = await db.execute(select(Appointment).where(Appointment.id == booking_id))
        appointment = result.scalars().first()
        if not appointment:
            raise HTTPException(404, "Запис не знайдено")

        if appointment.status not in [AppointmentStatusEnum.NEW, AppointmentStatusEnum.RESCHEDULED]:
            raise HTTPException(400, "Запис уже підтверджено або недоступний для підтвердження")

        if not appointment.otp_code_hash or not appointment.otp_expires_at:
            raise HTTPException(400, "Код підтвердження не знайдено")

        if _now() > _to_utc(appointment.otp_expires_at):
            reason = "expired_after_reschedule" if appointment.status == AppointmentStatusEnum.RESCHEDULED else "expired_confirmation"
            appointment.status = AppointmentStatusEnum.CANCELED
            appointment.otp_code_hash = None
            appointment.otp_expires_at = None
            appointment.notes = _append_note(appointment.notes, f"[AUTO_CANCELED: {reason}]")
            await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.CANCELED)
            await _push_outbox(
                db,
                event_type="APPOINTMENT_CANCELED",
                payload={
                    "salon_id": appointment.salon_id,
                    "appointment_id": appointment.id,
                    "client_id": appointment.client_id,
                    "reason": reason,
                },
            )
            await _audit_public(
                db,
                salon_id=appointment.salon_id,
                action="PUBLIC_APPOINTMENT_EXPIRED",
                resource_id=appointment.id,
                details={"reason": reason},
            )
            await db.commit()
            raise HTTPException(400, "Термін дії коду підтвердження минув")

        if not verify_password(req.otp_code, appointment.otp_code_hash):
            raise HTTPException(400, "Невірний код підтвердження")

        appointment.status = AppointmentStatusEnum.CONFIRMED
        appointment.otp_code_hash = None
        appointment.otp_expires_at = None
        await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.CONFIRMED)
        await _push_outbox(
            db,
            event_type="APPOINTMENT_CONFIRMED",
            payload={
                "salon_id": appointment.salon_id,
                "appointment_id": appointment.id,
                "client_id": appointment.client_id,
            },
        )
        await _audit_public(
            db,
            salon_id=appointment.salon_id,
            action="PUBLIC_APPOINTMENT_CONFIRMED",
            resource_id=appointment.id,
        )

        await db.commit()
        await db.refresh(appointment)
        return await _appointment_details(db, appointment)


async def _manage_booking_by_token(db: AsyncSession, token: str) -> Appointment:
    result = await db.execute(select(Appointment).where(Appointment.manage_token == token))
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(404, "Запис за токеном не знайдено")
    return appointment


@router.get("/bookings/manage/{manage_token}", response_model=PublicBookingDetails)
async def get_booking_by_manage_token(manage_token: str) -> Any:
    async with SessionLocal() as db:
        appointment = await _manage_booking_by_token(db, manage_token)
        return await _appointment_details(db, appointment)


@router.post("/bookings/manage/{manage_token}/confirm-link", response_model=PublicBookingDetails)
async def confirm_booking_by_link(manage_token: str) -> Any:
    async with SessionLocal() as db:
        appointment = await _manage_booking_by_token(db, manage_token)
        if appointment.status not in [AppointmentStatusEnum.NEW, AppointmentStatusEnum.RESCHEDULED]:
            raise HTTPException(400, "Запис не можна підтвердити за посиланням")

        if appointment.otp_expires_at and _now() > _to_utc(appointment.otp_expires_at):
            reason = "expired_after_reschedule" if appointment.status == AppointmentStatusEnum.RESCHEDULED else "expired_confirmation"
            appointment.status = AppointmentStatusEnum.CANCELED
            appointment.otp_code_hash = None
            appointment.otp_expires_at = None
            appointment.notes = _append_note(appointment.notes, f"[AUTO_CANCELED: {reason}]")
            await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.CANCELED)
            await _push_outbox(
                db,
                event_type="APPOINTMENT_CANCELED",
                payload={
                    "salon_id": appointment.salon_id,
                    "appointment_id": appointment.id,
                    "client_id": appointment.client_id,
                    "reason": reason,
                },
            )
            await db.commit()
            raise HTTPException(400, "Посилання протерміновано")

        appointment.status = AppointmentStatusEnum.CONFIRMED
        appointment.otp_code_hash = None
        appointment.otp_expires_at = None

        await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.CONFIRMED)
        await _push_outbox(
            db,
            event_type="APPOINTMENT_CONFIRMED",
            payload={
                "salon_id": appointment.salon_id,
                "appointment_id": appointment.id,
                "client_id": appointment.client_id,
            },
        )
        await _audit_public(
            db,
            salon_id=appointment.salon_id,
            action="PUBLIC_APPOINTMENT_CONFIRMED_LINK",
            resource_id=appointment.id,
        )

        await db.commit()
        await db.refresh(appointment)
        return await _appointment_details(db, appointment)


@router.post("/bookings/manage/{manage_token}/confirm", response_model=PublicBookingDetails)
async def confirm_booking_by_token_with_otp(manage_token: str, req: PublicConfirmRequest) -> Any:
    async with SessionLocal() as db:
        appointment = await _manage_booking_by_token(db, manage_token)
        if appointment.status not in [AppointmentStatusEnum.NEW, AppointmentStatusEnum.RESCHEDULED]:
            raise HTTPException(400, "Запис не потребує підтвердження")

        if not appointment.otp_code_hash:
            raise HTTPException(400, "OTP відсутній")
        if appointment.otp_expires_at and _now() > _to_utc(appointment.otp_expires_at):
            raise HTTPException(400, "OTP протермінований")
        if not verify_password(req.otp_code, appointment.otp_code_hash):
            raise HTTPException(400, "Невірний OTP")

        appointment.status = AppointmentStatusEnum.CONFIRMED
        appointment.otp_code_hash = None
        appointment.otp_expires_at = None

        await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.CONFIRMED)
        await _push_outbox(
            db,
            event_type="APPOINTMENT_CONFIRMED",
            payload={
                "salon_id": appointment.salon_id,
                "appointment_id": appointment.id,
                "client_id": appointment.client_id,
            },
        )
        await _audit_public(
            db,
            salon_id=appointment.salon_id,
            action="PUBLIC_APPOINTMENT_CONFIRMED_OTP",
            resource_id=appointment.id,
        )

        await db.commit()
        await db.refresh(appointment)
        return await _appointment_details(db, appointment)


@router.post("/bookings/manage/{manage_token}/cancel", response_model=PublicBookingDetails)
async def cancel_public_booking(manage_token: str, req: PublicCancelRequest) -> Any:
    async with SessionLocal() as db:
        appointment = await _manage_booking_by_token(db, manage_token)

        if appointment.status in [AppointmentStatusEnum.CANCELED, AppointmentStatusEnum.COMPLETED]:
            raise HTTPException(400, "Запис не можна скасувати")

        appointment.status = AppointmentStatusEnum.CANCELED
        appointment.otp_code_hash = None
        appointment.otp_expires_at = None
        appointment.notes = _append_note(appointment.notes, f"[PUBLIC_CANCEL: {req.reason or 'client_request'}]")

        await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.CANCELED)
        await _push_outbox(
            db,
            event_type="APPOINTMENT_CANCELED",
            payload={
                "salon_id": appointment.salon_id,
                "appointment_id": appointment.id,
                "client_id": appointment.client_id,
                "reason": req.reason or "client_request",
            },
        )
        await _audit_public(
            db,
            salon_id=appointment.salon_id,
            action="PUBLIC_APPOINTMENT_CANCELED",
            resource_id=appointment.id,
            details={"reason": req.reason or "client_request"},
        )

        await db.commit()
        await db.refresh(appointment)
        return await _appointment_details(db, appointment)


@router.post("/bookings/manage/{manage_token}/reschedule", response_model=PublicBookingCreatedResponse)
async def reschedule_public_booking(manage_token: str, req: PublicRescheduleRequest) -> Any:
    async with SessionLocal() as db:
        appointment = await _manage_booking_by_token(db, manage_token)

        if appointment.status in [AppointmentStatusEnum.CANCELED, AppointmentStatusEnum.COMPLETED]:
            raise HTTPException(400, "Запис не можна перенести")

        service = await _get_service_or_404(db, appointment.salon_id, appointment.service_id)

        new_start = _to_utc(req.new_start_time)
        if new_start <= _now():
            raise HTTPException(400, "Неможливо переносити запис у минуле")

        new_end = new_start + timedelta(minutes=service.duration_minutes)
        overlap = await _check_overlap(
            db,
            staff_id=appointment.staff_id,
            start_at=new_start,
            end_at=new_end,
            exclude_appt_id=appointment.id,
        )
        if overlap:
            raise HTTPException(400, "Новий слот вже зайнятий")

        old_start = appointment.start_time
        old_end = appointment.end_time

        appointment.start_time = new_start
        appointment.end_time = new_end
        appointment.status = AppointmentStatusEnum.RESCHEDULED
        new_otp = _otp()
        appointment.otp_code_hash = get_password_hash(new_otp)
        appointment.otp_expires_at = _now() + timedelta(minutes=120)
        appointment.notes = _append_note(
            appointment.notes,
            f"[PUBLIC_RESCHEDULE: {old_start.isoformat()} -> {new_start.isoformat()}]",
        )

        await _record_history(db, appointment=appointment, status=AppointmentStatusEnum.RESCHEDULED)
        await _push_outbox(
            db,
            event_type="APPOINTMENT_RESCHEDULED",
            payload={
                "salon_id": appointment.salon_id,
                "appointment_id": appointment.id,
                "client_id": appointment.client_id,
                "old_start_at": old_start.isoformat(),
                "old_end_at": old_end.isoformat(),
                "new_start_at": new_start.isoformat(),
                "new_end_at": new_end.isoformat(),
                "otp_code": new_otp,
                "reconfirm_ttl_minutes": 120,
                "manage_token": appointment.manage_token,
            },
        )
        await _audit_public(
            db,
            salon_id=appointment.salon_id,
            action="PUBLIC_APPOINTMENT_RESCHEDULED",
            resource_id=appointment.id,
            details={"old_start": old_start.isoformat(), "new_start": new_start.isoformat()},
        )

        await db.commit()
        await db.refresh(appointment)

        return PublicBookingCreatedResponse(
            booking_id=appointment.id,
            status=appointment.status,
            salon_id=appointment.salon_id,
            otp_expires_at=appointment.otp_expires_at,
            manage_token=appointment.manage_token,
            confirm_url=f"/zapys?booking={appointment.id}&step=confirm",
            cancel_url=f"/zapys/manage/{appointment.manage_token}?action=cancel",
            reschedule_url=f"/zapys/manage/{appointment.manage_token}?action=reschedule",
            otp_code_dev=new_otp,
        )
