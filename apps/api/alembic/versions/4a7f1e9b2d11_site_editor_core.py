"""site editor core tables

Revision ID: 4a7f1e9b2d11
Revises: 9f2f8d5b4e1c
Create Date: 2026-03-11 00:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4a7f1e9b2d11"
down_revision: Union[str, Sequence[str], None] = "9f2f8d5b4e1c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("files", sa.Column("title", sa.String(), nullable=True))
    op.alter_column("files", "salon_id", existing_type=sa.Integer(), nullable=True)

    op.create_table(
        "pages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("salon_id", sa.Integer(), nullable=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("seo_title", sa.String(), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("og_image_file_id", sa.Integer(), nullable=True),
        sa.Column("draft_version_id", sa.Integer(), nullable=True),
        sa.Column("published_version_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["salon_id"], ["salons.id"]),
        sa.ForeignKeyConstraint(["og_image_file_id"], ["files.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("salon_id", "slug", name="uq_pages_salon_slug"),
    )
    op.create_index(op.f("ix_pages_id"), "pages", ["id"], unique=False)
    op.create_index(
        "ix_pages_global_slug_unique",
        "pages",
        ["slug"],
        unique=True,
        postgresql_where=sa.text("salon_id IS NULL"),
    )

    op.create_table(
        "page_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("content_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_page_versions_id"), "page_versions", ["id"], unique=False)

    op.create_foreign_key(
        "fk_pages_draft_version",
        "pages",
        "page_versions",
        ["draft_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_pages_published_version",
        "pages",
        "page_versions",
        ["published_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "preview_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_preview_tokens_id"), "preview_tokens", ["id"], unique=False)
    op.create_index(op.f("ix_preview_tokens_token_hash"), "preview_tokens", ["token_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_preview_tokens_token_hash"), table_name="preview_tokens")
    op.drop_index(op.f("ix_preview_tokens_id"), table_name="preview_tokens")
    op.drop_table("preview_tokens")

    op.drop_constraint("fk_pages_published_version", "pages", type_="foreignkey")
    op.drop_constraint("fk_pages_draft_version", "pages", type_="foreignkey")
    op.drop_index(op.f("ix_page_versions_id"), table_name="page_versions")
    op.drop_table("page_versions")

    op.drop_index("ix_pages_global_slug_unique", table_name="pages")
    op.drop_index(op.f("ix_pages_id"), table_name="pages")
    op.drop_table("pages")

    op.alter_column("files", "salon_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("files", "title")
