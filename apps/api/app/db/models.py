import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, 
    Text, Enum as SQLEnum, Float, UniqueConstraint, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class RoleEnum(str, enum.Enum):
    NETWORK_ADMIN = "NETWORK_ADMIN"
    SALON_ADMIN = "SALON_ADMIN"
    OPERATOR = "OPERATOR"
    STAFF = "STAFF"
    CLIENT = "CLIENT"

class AppointmentStatusEnum(str, enum.Enum):
    NEW = "NEW"
    CONFIRMED = "CONFIRMED"
    CANCELED = "CANCELED"
    RESCHEDULED = "RESCHEDULED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"

class MessageChannelEnum(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"

class MessageStatusEnum(str, enum.Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    FAILED = "FAILED"

class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"

class Salon(Base):
    __tablename__ = "salons"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String)
    timezone = Column(String, default="UTC")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    users_access = relationship("UserSalonAccess", back_populates="salon")
    services = relationship("Service", back_populates="salon")
    staff = relationship("Staff", back_populates="salon")
    clients = relationship("Client", back_populates="salon")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    global_role = Column(SQLEnum(RoleEnum), default=RoleEnum.CLIENT)
    is_active = Column(Boolean, default=True)
    
    salon_access = relationship("UserSalonAccess", back_populates="user")
    staff_profile = relationship("Staff", back_populates="user", uselist=False)

class UserSalonAccess(Base):
    __tablename__ = "user_salon_access"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    role_override = Column(SQLEnum(RoleEnum), nullable=True) # If null, use global_role
    
    user = relationship("User", back_populates="salon_access")
    salon = relationship("Salon", back_populates="users_access")
    
    __table_args__ = (UniqueConstraint('user_id', 'salon_id', name='uq_user_salon'),)

class ServiceCategory(Base):
    __tablename__ = "service_categories"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)

    services = relationship("Service", back_populates="category")

class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=60)
    buffer_before = Column(Integer, default=0)
    buffer_after = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    
    salon = relationship("Salon", back_populates="services")
    category = relationship("ServiceCategory", back_populates="services")
    staff_links = relationship("StaffService", back_populates="service")

class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    avatar_file_id = Column(Integer, ForeignKey("files.id"), nullable=True)
    
    salon = relationship("Salon", back_populates="staff")
    user = relationship("User", back_populates="staff_profile")
    service_links = relationship("StaffService", back_populates="staff")
    working_hours = relationship("StaffWorkingHours", back_populates="staff")
    days_off = relationship("StaffDaysOff", back_populates="staff")

class StaffService(Base):
    __tablename__ = "staff_services"
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    
    staff = relationship("Staff", back_populates="service_links")
    service = relationship("Service", back_populates="staff_links")

class StaffWorkingHours(Base):
    __tablename__ = "staff_working_hours"
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0 = Monday, 6 = Sunday
    start_time = Column(String, nullable=False) # "09:00"
    end_time = Column(String, nullable=False) # "18:00"
    is_working = Column(Boolean, default=True)

    staff = relationship("Staff", back_populates="working_hours")

class StaffDaysOff(Base):
    __tablename__ = "staff_days_off"
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    reason = Column(String, nullable=True)

    staff = relationship("Staff", back_populates="days_off")

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Linked if they make an account
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    salon = relationship("Salon", back_populates="clients")
    appointments = relationship("Appointment", back_populates="client")
    tags = relationship("ClientTag", back_populates="client")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)

class ClientTag(Base):
    __tablename__ = "client_tags"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    
    client = relationship("Client", back_populates="tags")
    tag = relationship("Tag")

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(AppointmentStatusEnum), default=AppointmentStatusEnum.NEW)
    notes = Column(Text, nullable=True)
    otp_code_hash = Column(String, nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    manage_token = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("Client", back_populates="appointments")
    staff = relationship("Staff")
    service = relationship("Service")
    history = relationship("AppointmentStatusHistory", back_populates="appointment")
    payments = relationship("PaymentIntent", back_populates="appointment")

class AppointmentStatusHistory(Base):
    __tablename__ = "appointment_status_history"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    status = Column(SQLEnum(AppointmentStatusEnum), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    appointment = relationship("Appointment", back_populates="history")

class PaymentIntent(Base):
    __tablename__ = "payment_intents"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SQLEnum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("Appointment", back_populates="payments")
    payments = relationship("Payment", back_populates="intent")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    intent_id = Column(Integer, ForeignKey("payment_intents.id"), nullable=False)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False) # e.g. "CASH", "CARD"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    intent = relationship("PaymentIntent", back_populates="payments")

class MessageTemplate(Base):
    __tablename__ = "message_templates"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    name = Column(String, nullable=False)
    channel = Column(SQLEnum(MessageChannelEnum), nullable=False)
    content = Column(Text, nullable=False)

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    channel = Column(SQLEnum(MessageChannelEnum), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(SQLEnum(MessageStatusEnum), default=MessageStatusEnum.QUEUED)
    provider_response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class EventOutbox(Base):
    __tablename__ = "event_outbox"
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False) # e.g. "APPOINTMENT_CREATED"
    payload = Column(JSON, nullable=False)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class File(Base):
    __tablename__ = "files"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=True)
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(Integer, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Page(Base):
    __tablename__ = "pages"
    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("salons.id"), nullable=True)
    slug = Column(String, nullable=False)
    title = Column(String, nullable=False)
    seo_title = Column(String, nullable=True)
    seo_description = Column(Text, nullable=True)
    og_image_file_id = Column(Integer, ForeignKey("files.id"), nullable=True)
    draft_version_id = Column(Integer, ForeignKey("page_versions.id"), nullable=True)
    published_version_id = Column(Integer, ForeignKey("page_versions.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("salon_id", "slug", name="uq_pages_salon_slug"),
        Index("ix_pages_global_slug_unique", "slug", unique=True, postgresql_where=(salon_id.is_(None))),
    )


class PageVersion(Base):
    __tablename__ = "page_versions"
    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    content_json = Column(JSON, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PreviewToken(Base):
    __tablename__ = "preview_tokens"
    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
