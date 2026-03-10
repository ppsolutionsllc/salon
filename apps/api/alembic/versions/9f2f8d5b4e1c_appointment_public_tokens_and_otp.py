"""appointment public tokens and otp

Revision ID: 9f2f8d5b4e1c
Revises: c7d68ffcf819
Create Date: 2026-03-09 20:43:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f2f8d5b4e1c"
down_revision: Union[str, Sequence[str], None] = "c7d68ffcf819"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("otp_code_hash", sa.String(), nullable=True))
    op.add_column("appointments", sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("appointments", sa.Column("manage_token", sa.String(), nullable=True))
    op.create_index(op.f("ix_appointments_manage_token"), "appointments", ["manage_token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_appointments_manage_token"), table_name="appointments")
    op.drop_column("appointments", "manage_token")
    op.drop_column("appointments", "otp_expires_at")
    op.drop_column("appointments", "otp_code_hash")
