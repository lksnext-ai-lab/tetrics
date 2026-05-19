"""
Metric model - Specific metric that measures an evaluation criterion.
"""
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.domain.constants import CASCADE_DELETE_ORPHAN
from app.models.domain.enums import MetricUnit, NormalizationMethod, ScaleType, CollectionMethod, Direction

if TYPE_CHECKING:
    from app.models.domain.evaluation_criterion import EvaluationCriterion
    from app.models.domain.measurement import Measurement


class Metric(BaseModel):
    """
    Specific metric that measures an evaluation criterion.
    """
    __tablename__ = "metrics"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[MetricUnit] = mapped_column(String(20), nullable=False)
    scale_type: Mapped[ScaleType] = mapped_column(String(20), nullable=False)
    collection_method: Mapped[CollectionMethod] = mapped_column(String(20), nullable=False)
    normalization_method: Mapped[NormalizationMethod] = mapped_column(
        String(20), nullable=False, default=NormalizationMethod.NONE
    )
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    target_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    direction: Mapped[Direction] = mapped_column(String(20), nullable=False)

    # Foreign key
    evaluation_criterion_id: Mapped[str] = mapped_column(
        PostgresUUID(as_uuid=True), ForeignKey("evaluation_criteria.id"), nullable=False
    )

    # Relationships
    evaluation_criterion: Mapped["EvaluationCriterion"] = relationship(
        "EvaluationCriterion", back_populates="metrics"
    )
    measurements: Mapped[List["Measurement"]] = relationship(
        "Measurement", back_populates="metric", cascade=CASCADE_DELETE_ORPHAN
    )
