import os
import shutil
import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.config import settings
from app.db.database import get_db
from app.db.models import File, Salon, User

router = APIRouter()

@router.post("/{salon_id}/files")
async def upload_file(
    salon_id: int,
    is_public: bool = False,
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    # ensure directories exist
    public_dir = os.path.join(settings.UPLOADS_DIR, "public")
    private_dir = os.path.join(settings.UPLOADS_DIR, "private")
    os.makedirs(public_dir, exist_ok=True)
    os.makedirs(private_dir, exist_ok=True)

    ext = file.filename.split(".")[-1]
    safe_filename = f"{uuid.uuid4()}.{ext}"
    
    target_dir = public_dir if is_public else private_dir
    file_path = os.path.join(target_dir, safe_filename)
    
    # Read/write
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    size = os.path.getsize(file_path)
    
    # save metadata in db
    db_file = File(
        salon_id=salon_id,
        uploaded_by_user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        size_bytes=size,
        is_public=is_public
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)
    
    return {
        "id": db_file.id,
        "filename": db_file.filename,
        "is_public": db_file.is_public,
        "public_url": f"/public/{safe_filename}" if is_public else None
    }

@router.get("/{salon_id}/files/{file_id}")
async def download_private_file(
    salon_id: int,
    file_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(
        select(File)
        .where(File.id == file_id)
        .where(File.salon_id == salon_id)
    )
    db_file = result.scalars().first()
    
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=404, detail="File missing on disk")
        
    return FileResponse(path=db_file.file_path, filename=db_file.filename, media_type=db_file.mime_type)
