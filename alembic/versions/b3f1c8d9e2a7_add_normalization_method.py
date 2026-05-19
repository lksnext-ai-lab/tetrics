"""Add normalization_method column to metrics table.

Revision ID: b3f1c8d9e2a7
Revises: a67544ca8007
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa


revision = 'b3f1c8d9e2a7'
down_revision = 'a67544ca8007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'metrics',
        sa.Column(
            'normalization_method',
            sa.String(length=20),
            nullable=False,
            server_default='none'
        )
    )


def downgrade():
    op.drop_column('metrics', 'normalization_method')
