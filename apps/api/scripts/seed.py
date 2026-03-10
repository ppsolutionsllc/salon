"""
Comprehensive interconnected seed data for Aesthetic Prime.
Creates:
  - 1 NETWORK_ADMIN
  - 2 Salons
  - 2 SALON_ADMIN users with salon access
  - 4 Staff members with user accounts (can log in to /staff)
  - Categories and services per salon
  - Staff working hours + service assignments
  - 6 Clients with user accounts (can log in to /client)
  - 6 Appointments in various statuses (NEW, CONFIRMED, COMPLETED, CANCELED)
  - Payments for completed appointments
  - Message templates per salon
  - Event outbox entries
  - Audit log entries
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db.models import (
    User, Salon, UserSalonAccess, RoleEnum,
    ServiceCategory, Service,
    Staff, StaffService, StaffWorkingHours,
    Client, Tag, ClientTag,
    Appointment, AppointmentStatusHistory, AppointmentStatusEnum,
    PaymentIntent, Payment, PaymentStatusEnum,
    MessageTemplate, MessageChannelEnum,
    EventOutbox, AuditLog
)
from app.core.security import get_password_hash
from sqlalchemy.future import select


def utcnow():
    return datetime.now(timezone.utc)


async def get_or_create_user(db, email, password, role):
    res = await db.execute(select(User).where(User.email == email))
    u = res.scalars().first()
    if not u:
        u = User(email=email, hashed_password=get_password_hash(password),
                 global_role=role, is_active=True)
        db.add(u)
        await db.flush()
    return u


async def seed_data():
    async with SessionLocal() as db:
        print("=" * 60)
        print("Aesthetic Prime – Comprehensive Seed")
        print("=" * 60)

        # ──────────────────────────────────────────────────────── #
        # 1. USERS
        # ──────────────────────────────────────────────────────── #
        seed_admin_email = os.getenv("SEED_NETWORK_ADMIN_EMAIL", "admin")
        seed_admin_password = os.getenv("SEED_NETWORK_ADMIN_PASSWORD", "admin12345")

        admin = await get_or_create_user(db, seed_admin_email, seed_admin_password, RoleEnum.NETWORK_ADMIN)
        salon_admin1 = await get_or_create_user(db, "salon1.admin@prime.local", "salon12345", RoleEnum.SALON_ADMIN)
        salon_admin2 = await get_or_create_user(db, "salon2.admin@prime.local", "salon12345", RoleEnum.SALON_ADMIN)

        # Staff user accounts
        staff_user1 = await get_or_create_user(db, "olena.kovalchuk@prime.local", "staff12345", RoleEnum.STAFF)
        staff_user2 = await get_or_create_user(db, "marta.savchenko@prime.local", "staff12345", RoleEnum.STAFF)
        staff_user3 = await get_or_create_user(db, "iryna.petrenko@prime.local", "staff12345", RoleEnum.STAFF)
        staff_user4 = await get_or_create_user(db, "natalia.bondar@prime.local", "staff12345", RoleEnum.STAFF)

        # Client user accounts
        client_user1 = await get_or_create_user(db, "ana.shevchenko@gmail.com", "client12345", RoleEnum.CLIENT)
        client_user2 = await get_or_create_user(db, "yulia.marchenko@gmail.com", "client12345", RoleEnum.CLIENT)
        client_user3 = await get_or_create_user(db, "sofia.kravchenko@gmail.com", "client12345", RoleEnum.CLIENT)
        client_user4 = await get_or_create_user(db, "diana.lysenko@gmail.com", "client12345", RoleEnum.CLIENT)
        client_user5 = await get_or_create_user(db, "victoria.pavlenko@gmail.com", "client12345", RoleEnum.CLIENT)
        client_user6 = await get_or_create_user(db, "oksana.moroz@gmail.com", "client12345", RoleEnum.CLIENT)

        await db.commit()
        print("✓ Users created")

        # ──────────────────────────────────────────────────────── #
        # 2. SALONS
        # ──────────────────────────────────────────────────────── #
        res = await db.execute(select(Salon).where(Salon.name == "Aesthetic Prime — Центр"))
        salon1 = res.scalars().first()
        if not salon1:
            salon1 = Salon(name="Aesthetic Prime — Центр", address="вул. Хрещатик, 5, Київ", timezone="Europe/Kiev")
            db.add(salon1)
            await db.flush()

        res = await db.execute(select(Salon).where(Salon.name == "Aesthetic Prime — Оболонь"))
        salon2 = res.scalars().first()
        if not salon2:
            salon2 = Salon(name="Aesthetic Prime — Оболонь", address="просп. Оболонський, 22, Київ", timezone="Europe/Kiev")
            db.add(salon2)
            await db.flush()

        await db.commit()
        print("✓ Salons created")

        # ──────────────────────────────────────────────────────── #
        # 3. SALON ACCESS
        # ──────────────────────────────────────────────────────── #
        async def grant_access(user, salon, role=None):
            res = await db.execute(
                select(UserSalonAccess)
                .where(UserSalonAccess.user_id == user.id)
                .where(UserSalonAccess.salon_id == salon.id)
            )
            if not res.scalars().first():
                db.add(UserSalonAccess(user_id=user.id, salon_id=salon.id, role_override=role))

        # Network admin sees all – give explicit access too
        await grant_access(admin, salon1)
        await grant_access(admin, salon2)
        await grant_access(salon_admin1, salon1)
        await grant_access(salon_admin2, salon2)
        await db.commit()
        print("✓ Salon access granted")

        # ──────────────────────────────────────────────────────── #
        # 4. SERVICE CATEGORIES + SERVICES
        # ──────────────────────────────────────────────────────── #
        async def get_or_create_cat(db, salon_id, name, color):
            res = await db.execute(
                select(ServiceCategory).where(ServiceCategory.salon_id == salon_id, ServiceCategory.name == name)
            )
            c = res.scalars().first()
            if not c:
                c = ServiceCategory(salon_id=salon_id, name=name, color=color)
                db.add(c)
                await db.flush()
            return c

        # Salon 1 categories
        cat_hair1 = await get_or_create_cat(db, salon1.id, "Волосся", "#f43f5e")
        cat_nails1 = await get_or_create_cat(db, salon1.id, "Нігті", "#8b5cf6")
        cat_face1 = await get_or_create_cat(db, salon1.id, "Обличчя", "#3b82f6")
        cat_body1 = await get_or_create_cat(db, salon1.id, "Тіло", "#10b981")

        # Salon 2 categories
        cat_hair2 = await get_or_create_cat(db, salon2.id, "Волосся", "#f43f5e")
        cat_nails2 = await get_or_create_cat(db, salon2.id, "Нігті", "#8b5cf6")

        async def get_or_create_svc(db, salon_id, cat_id, name, duration, price, buf_b=0, buf_a=10):
            res = await db.execute(
                select(Service).where(Service.salon_id == salon_id, Service.name == name)
            )
            s = res.scalars().first()
            if not s:
                s = Service(salon_id=salon_id, category_id=cat_id, name=name,
                            duration_minutes=duration, price=price,
                            buffer_before=buf_b, buffer_after=buf_a)
                db.add(s)
                await db.flush()
            return s

        # Salon 1 services
        svc_haircut1 = await get_or_create_svc(db, salon1.id, cat_hair1.id, "Стрижка жіноча", 60, 450, 0, 15)
        svc_color1   = await get_or_create_svc(db, salon1.id, cat_hair1.id, "Фарбування волосся", 120, 900, 10, 15)
        svc_blowdry1 = await get_or_create_svc(db, salon1.id, cat_hair1.id, "Укладання", 45, 300, 0, 10)
        svc_mani1    = await get_or_create_svc(db, salon1.id, cat_nails1.id, "Манікюр з гель-лаком", 75, 380, 0, 5)
        svc_pedi1    = await get_or_create_svc(db, salon1.id, cat_nails1.id, "Педикюр апаратний", 90, 520, 0, 10)
        svc_facial1  = await get_or_create_svc(db, salon1.id, cat_face1.id, "Чистка обличчя", 60, 650, 5, 10)
        svc_massage1 = await get_or_create_svc(db, salon1.id, cat_body1.id, "Масаж спини", 60, 750, 10, 10)

        # Salon 2 services
        svc_haircut2 = await get_or_create_svc(db, salon2.id, cat_hair2.id, "Стрижка жіноча", 60, 420, 0, 15)
        svc_color2   = await get_or_create_svc(db, salon2.id, cat_hair2.id, "Фарбування", 120, 850, 10, 15)
        svc_mani2    = await get_or_create_svc(db, salon2.id, cat_nails2.id, "Манікюр", 60, 350, 0, 5)

        await db.commit()
        print("✓ Services created")

        # ──────────────────────────────────────────────────────── #
        # 5. STAFF with USER ACCOUNTS
        # ──────────────────────────────────────────────────────── #
        async def get_or_create_staff(db, salon_id, user_id, first_name, last_name, phone):
            res = await db.execute(
                select(Staff).where(Staff.salon_id == salon_id, Staff.user_id == user_id)
            )
            s = res.scalars().first()
            if not s:
                s = Staff(salon_id=salon_id, user_id=user_id,
                          first_name=first_name, last_name=last_name, phone=phone)
                db.add(s)
                await db.flush()
            return s

        # Grant staff salon access
        await grant_access(staff_user1, salon1, RoleEnum.STAFF)
        await grant_access(staff_user2, salon1, RoleEnum.STAFF)
        await grant_access(staff_user3, salon1, RoleEnum.STAFF)
        await grant_access(staff_user4, salon2, RoleEnum.STAFF)

        staff1 = await get_or_create_staff(db, salon1.id, staff_user1.id, "Олена", "Ковальчук", "+380671234501")
        staff2 = await get_or_create_staff(db, salon1.id, staff_user2.id, "Марта", "Савченко", "+380671234502")
        staff3 = await get_or_create_staff(db, salon1.id, staff_user3.id, "Ірина", "Петренко", "+380671234503")
        staff4 = await get_or_create_staff(db, salon2.id, staff_user4.id, "Наталія", "Бондар", "+380671234504")

        await db.commit()
        print("✓ Staff profiles created (linked to user accounts)")

        # ──────────────────────────────────────────────────────── #
        # 6. STAFF WORKING HOURS (Mon–Sat 09:00–19:00)
        # ──────────────────────────────────────────────────────── #
        async def ensure_working_hours(db, staff, salon_id):
            res = await db.execute(
                select(StaffWorkingHours).where(StaffWorkingHours.staff_id == staff.id)
            )
            if res.scalars().first():
                return
            working_days = [0, 1, 2, 3, 4, 5]  # Mon–Sat
            for day in range(7):
                db.add(StaffWorkingHours(
                    staff_id=staff.id, salon_id=salon_id,
                    day_of_week=day,
                    start_time="09:00", end_time="19:00",
                    is_working=(day in working_days)
                ))

        await ensure_working_hours(db, staff1, salon1.id)
        await ensure_working_hours(db, staff2, salon1.id)
        await ensure_working_hours(db, staff3, salon1.id)
        await ensure_working_hours(db, staff4, salon2.id)
        await db.commit()
        print("✓ Working hours set")

        # ──────────────────────────────────────────────────────── #
        # 7. STAFF ↔ SERVICES ASSIGNMENTS
        # ──────────────────────────────────────────────────────── #
        async def link_svc(db, staff, service):
            res = await db.execute(
                select(StaffService).where(StaffService.staff_id == staff.id, StaffService.service_id == service.id)
            )
            if not res.scalars().first():
                db.add(StaffService(staff_id=staff.id, service_id=service.id))

        # Staff1 = hair
        for s in [svc_haircut1, svc_color1, svc_blowdry1]:
            await link_svc(db, staff1, s)
        # Staff2 = nails
        for s in [svc_mani1, svc_pedi1]:
            await link_svc(db, staff2, s)
        # Staff3 = face + body
        for s in [svc_facial1, svc_massage1]:
            await link_svc(db, staff3, s)
        # Staff4 (salon2) = hair + nails
        for s in [svc_haircut2, svc_color2, svc_mani2]:
            await link_svc(db, staff4, s)

        await db.commit()
        print("✓ Staff-service assignments done")

        # ──────────────────────────────────────────────────────── #
        # 8. CLIENTS with USER ACCOUNTS
        # ──────────────────────────────────────────────────────── #
        async def get_or_create_client(db, salon_id, user_id, first_name, last_name, phone, email, notes=""):
            res = await db.execute(
                select(Client).where(Client.salon_id == salon_id, Client.phone == phone)
            )
            c = res.scalars().first()
            if not c:
                c = Client(salon_id=salon_id, user_id=user_id,
                           first_name=first_name, last_name=last_name,
                           phone=phone, email=email, notes=notes)
                db.add(c)
                await db.flush()
            return c

        # Clients for Salon 1
        client1 = await get_or_create_client(db, salon1.id, client_user1.id, "Анна", "Шевченко", "+380671111001", "ana.shevchenko@gmail.com", "VIP клієнт, алергія на аміак")
        client2 = await get_or_create_client(db, salon1.id, client_user2.id, "Юлія", "Марченко", "+380671111002", "yulia.marchenko@gmail.com", "Любить натуральні відтінки")
        client3 = await get_or_create_client(db, salon1.id, client_user3.id, "Софія", "Кравченко", "+380671111003", "sofia.kravchenko@gmail.com")
        client4 = await get_or_create_client(db, salon1.id, client_user4.id, "Діана", "Лисенко", "+380671111004", "diana.lysenko@gmail.com")
        # Client for Salon 2
        client5 = await get_or_create_client(db, salon2.id, client_user5.id, "Вікторія", "Павленко", "+380671111005", "victoria.pavlenko@gmail.com")
        client6 = await get_or_create_client(db, salon2.id, client_user6.id, "Оксана", "Мороз", "+380671111006", "oksana.moroz@gmail.com", "Постійна клієнтка")

        await db.commit()
        print("✓ Clients created (linked to user accounts)")

        # ──────────────────────────────────────────────────────── #
        # 9. TAGS
        # ──────────────────────────────────────────────────────── #
        async def get_or_create_tag(db, salon_id, name, color):
            res = await db.execute(select(Tag).where(Tag.salon_id == salon_id, Tag.name == name))
            t = res.scalars().first()
            if not t:
                t = Tag(salon_id=salon_id, name=name, color=color)
                db.add(t)
                await db.flush()
            return t

        tag_vip = await get_or_create_tag(db, salon1.id, "VIP", "#fbbf24")
        tag_regular = await get_or_create_tag(db, salon1.id, "Постійна", "#10b981")
        tag_new = await get_or_create_tag(db, salon1.id, "Новий клієнт", "#3b82f6")

        async def ensure_client_tag(db, client_id, tag_id):
            res = await db.execute(
                select(ClientTag).where(ClientTag.client_id == client_id, ClientTag.tag_id == tag_id)
            )
            if not res.scalars().first():
                db.add(ClientTag(client_id=client_id, tag_id=tag_id))

        await ensure_client_tag(db, client1.id, tag_vip.id)
        await ensure_client_tag(db, client2.id, tag_regular.id)
        await ensure_client_tag(db, client3.id, tag_new.id)
        await db.commit()
        print("✓ Tags assigned")

        # ──────────────────────────────────────────────────────── #
        # 10. APPOINTMENTS (interconnected across all statuses)
        # ──────────────────────────────────────────────────────── #
        now = utcnow()

        async def create_appointment_with_history(
            db, salon_id, client, staff, service, start_dt, status, actor_id
        ):
            res = await db.execute(
                select(Appointment).where(
                    Appointment.salon_id == salon_id,
                    Appointment.client_id == client.id,
                    Appointment.start_time == start_dt
                )
            )
            appt = res.scalars().first()
            if not appt:
                end_dt = start_dt + timedelta(minutes=service.duration_minutes)
                appt = Appointment(
                    salon_id=salon_id, client_id=client.id,
                    staff_id=staff.id, service_id=service.id,
                    start_time=start_dt, end_time=end_dt,
                    status=status
                )
                db.add(appt)
                await db.flush()
                # Add status history
                db.add(AppointmentStatusHistory(
                    appointment_id=appt.id, salon_id=salon_id,
                    status=AppointmentStatusEnum.NEW,
                    changed_by_user_id=actor_id
                ))
                if status != AppointmentStatusEnum.NEW:
                    db.add(AppointmentStatusHistory(
                        appointment_id=appt.id, salon_id=salon_id,
                        status=status, changed_by_user_id=actor_id
                    ))
                await db.flush()
            return appt

        # Salon 1 appointments
        # Future: NEW (waiting confirmation)
        appt1 = await create_appointment_with_history(
            db, salon1.id, client1, staff1, svc_haircut1,
            now + timedelta(days=2, hours=10), AppointmentStatusEnum.NEW, admin.id
        )
        # Future: CONFIRMED
        appt2 = await create_appointment_with_history(
            db, salon1.id, client2, staff1, svc_color1,
            now + timedelta(days=3, hours=12), AppointmentStatusEnum.CONFIRMED, admin.id
        )
        # Today: CONFIRMED
        appt3 = await create_appointment_with_history(
            db, salon1.id, client3, staff2, svc_mani1,
            now + timedelta(hours=2), AppointmentStatusEnum.CONFIRMED, admin.id
        )
        # Past: COMPLETED (with payment)
        appt4 = await create_appointment_with_history(
            db, salon1.id, client4, staff3, svc_facial1,
            now - timedelta(days=1, hours=3), AppointmentStatusEnum.COMPLETED, admin.id
        )
        # Past: CANCELED
        appt5 = await create_appointment_with_history(
            db, salon1.id, client1, staff2, svc_pedi1,
            now - timedelta(days=3), AppointmentStatusEnum.CANCELED, salon_admin1.id
        )
        # Past: COMPLETED with payment (another)
        appt6_past = await create_appointment_with_history(
            db, salon1.id, client2, staff1, svc_blowdry1,
            now - timedelta(days=5), AppointmentStatusEnum.COMPLETED, staff_user1.id
        )

        # Salon 2 appointments
        appt7 = await create_appointment_with_history(
            db, salon2.id, client5, staff4, svc_haircut2,
            now + timedelta(days=1, hours=11), AppointmentStatusEnum.CONFIRMED, salon_admin2.id
        )
        appt8 = await create_appointment_with_history(
            db, salon2.id, client6, staff4, svc_mani2,
            now - timedelta(days=2), AppointmentStatusEnum.COMPLETED, salon_admin2.id
        )

        await db.commit()
        print("✓ Appointments created")

        # ──────────────────────────────────────────────────────── #
        # 11. PAYMENTS for completed appointments
        # ──────────────────────────────────────────────────────── #
        async def create_payment(db, salon_id, appointment, client, amount, method="CASH"):
            res = await db.execute(
                select(PaymentIntent).where(PaymentIntent.appointment_id == appointment.id)
            )
            if res.scalars().first():
                return
            intent = PaymentIntent(
                salon_id=salon_id, appointment_id=appointment.id,
                client_id=client.id, amount=amount,
                status=PaymentStatusEnum.SUCCEEDED
            )
            db.add(intent)
            await db.flush()
            db.add(Payment(
                intent_id=intent.id, salon_id=salon_id,
                amount=amount, method=method
            ))

        await create_payment(db, salon1.id, appt4, client4, svc_facial1.price, "CARD")
        await create_payment(db, salon1.id, appt6_past, client2, svc_blowdry1.price, "CASH")
        await create_payment(db, salon2.id, appt8, client6, svc_mani2.price, "CASH")

        await db.commit()
        print("✓ Payments created")

        # ──────────────────────────────────────────────────────── #
        # 12. MESSAGE TEMPLATES
        # ──────────────────────────────────────────────────────── #
        templates = [
            (salon1.id, "Підтвердження запису", MessageChannelEnum.SMS,
             "Ваш запис до {service} {date} о {time} підтверджено! Aesthetic Prime."),
            (salon1.id, "Нагадування (24 год)", MessageChannelEnum.SMS,
             "Нагадуємо: завтра {date} о {time} — запис до {service}. Aesthetic Prime."),
            (salon1.id, "Після візиту", MessageChannelEnum.EMAIL,
             "Дякуємо за візит! Будемо раді бачити вас знову. Aesthetic Prime."),
            (salon2.id, "Підтвердження запису", MessageChannelEnum.SMS,
             "Ваш запис підтверджено! Салон Оболонь, {date} о {time}."),
        ]
        for salon_id, name, channel, content in templates:
            res = await db.execute(
                select(MessageTemplate).where(
                    MessageTemplate.salon_id == salon_id,
                    MessageTemplate.name == name
                )
            )
            if not res.scalars().first():
                db.add(MessageTemplate(salon_id=salon_id, name=name, channel=channel, content=content))

        await db.commit()
        print("✓ Message templates created")

        # ──────────────────────────────────────────────────────── #
        # 13. EVENT OUTBOX (demo unprocessed events)
        # ──────────────────────────────────────────────────────── #
        res = await db.execute(
            select(EventOutbox).where(EventOutbox.event_type == "APPOINTMENT_CREATED")
        )
        if not res.scalars().first():
            db.add(EventOutbox(
                event_type="APPOINTMENT_CREATED",
                payload={
                    "salon_id": salon1.id,
                    "appointment_id": appt1.id,
                    "client_id": client1.id
                },
                processed=False
            ))
            db.add(EventOutbox(
                event_type="APPOINTMENT_CONFIRMED",
                payload={
                    "salon_id": salon1.id,
                    "appointment_id": appt2.id,
                    "client_id": client2.id
                },
                processed=True
            ))

        await db.commit()
        print("✓ Event outbox seeded")

        # ──────────────────────────────────────────────────────── #
        # 14. AUDIT LOGS
        # ──────────────────────────────────────────────────────── #
        res = await db.execute(select(AuditLog).where(AuditLog.resource_type == "appointment"))
        if not res.scalars().first():
            db.add(AuditLog(
                salon_id=salon1.id, user_id=admin.id,
                action="status_change", resource_type="appointment",
                resource_id=appt4.id,
                details={"from": "CONFIRMED", "to": "COMPLETED"}
            ))
            db.add(AuditLog(
                salon_id=salon1.id, user_id=salon_admin1.id,
                action="status_change", resource_type="appointment",
                resource_id=appt5.id,
                details={"from": "CONFIRMED", "to": "CANCELED", "reason": "client_request"}
            ))

        await db.commit()
        print("✓ Audit logs seeded")

        # ──────────────────────────────────────────────────────── #
        # SUMMARY
        # ──────────────────────────────────────────────────────── #
        print()
        print("=" * 60)
        print("ACCOUNTS READY (all can log in via /login):")
        print("=" * 60)
        print()
        print("── NETWORK ADMIN ──────────────────────────────────────")
        print(f"  login:    {seed_admin_email}")
        print(f"  password: {seed_admin_password}")
        print("  cabinet:  /crm/dashboard")
        print()
        print("── SALON ADMINS ────────────────────────────────────────")
        print("  login:    salon1.admin@prime.local  password: salon12345  → /crm")
        print("  login:    salon2.admin@prime.local  password: salon12345  → /crm")
        print()
        print("── STAFF (cabinet: /staff/dashboard) ──────────────────")
        print("  olena.kovalchuk@prime.local   / staff12345  (Волосся, Salon 1)")
        print("  marta.savchenko@prime.local   / staff12345  (Нігті, Salon 1)")
        print("  iryna.petrenko@prime.local    / staff12345  (Обличчя, Salon 1)")
        print("  natalia.bondar@prime.local    / staff12345  (Salon 2)")
        print()
        print("── CLIENTS (cabinet: /client/dashboard) ────────────────")
        print("  ana.shevchenko@gmail.com     / client12345")
        print("  yulia.marchenko@gmail.com    / client12345")
        print("  sofia.kravchenko@gmail.com   / client12345")
        print("  diana.lysenko@gmail.com      / client12345")
        print("  victoria.pavlenko@gmail.com  / client12345  (Salon 2)")
        print("  oksana.moroz@gmail.com       / client12345  (Salon 2)")
        print()
        print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed_data())
