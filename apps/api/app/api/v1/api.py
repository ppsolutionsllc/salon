from fastapi import APIRouter
from app.api.v1.endpoints import (
    appointments,
    auth,
    clients,
    files,
    messages,
    payments,
    public,
    salons,
    services,
    site_editor,
    staff,
    system,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(salons.router, prefix="/salons", tags=["salons"])
api_router.include_router(services.router, prefix="/salons", tags=["services"])
api_router.include_router(staff.router, prefix="/salons", tags=["staff"])
api_router.include_router(clients.router, prefix="/salons", tags=["clients"])
api_router.include_router(appointments.router, prefix="/salons", tags=["appointments"])
api_router.include_router(messages.router, prefix="/salons", tags=["messages"])
api_router.include_router(payments.router, prefix="/salons", tags=["payments"])
api_router.include_router(files.router, prefix="/salons", tags=["files"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(site_editor.router, tags=["site-editor"])
