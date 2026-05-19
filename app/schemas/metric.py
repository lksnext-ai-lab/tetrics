"""
Schemas for Metric entity.

A Metric is a specific measure that quantifies an evaluation criterion.
"""
from typing import Optional
from uuid import UUID

from pydantic import Field

from app.models.domain import CollectionMethod, Direction, MetricUnit, NormalizationMethod, ScaleType
from app.schemas.base import BaseCreateSchema, BaseResponseSchema, BaseSchema, BaseUpdateSchema


class MetricBase(BaseSchema):
    """Shared fields for Metric operations."""
    
    name: str = Field(
        ...,
        description="Name of the metric",
        min_length=1,
        max_length=255
    )
    definition: str = Field(
        ...,
        description="Formal definition of how this metric is measured",
        min_length=1
    )
    unit: MetricUnit = Field(
        ...,
        description="Unit of measurement (Percent or Cardinal)"
    )
    scale_type: ScaleType = Field(
        ...,
        description="Type of measurement scale (nominal, ordinal, interval, ratio)"
    )
    collection_method: CollectionMethod = Field(
        ...,
        description="How the metric data is collected (automated, manual, hybrid)"
    )
    normalization_method: NormalizationMethod = Field(
        default=NormalizationMethod.NONE,
        description="Normalization method for measurement values (none, max, min)"
    )
    weight: float = Field(
        default=1.0,
        description="Weight of this metric within its criterion (can be negative for penalties)"
    )
    target_value: Optional[float] = Field(
        None,
        description="Target value for this metric (if applicable)"
    )
    direction: Direction = Field(
        ...,
        description="Optimization direction (higher_is_better, lower_is_better, target_value)"
    )


class MetricCreate(MetricBase, BaseCreateSchema):
    """Schema for creating a new metric."""
    
    evaluation_criterion_id: UUID = Field(
        ...,
        description="ID of the parent evaluation criterion"
    )


class MetricUpdate(BaseUpdateSchema):
    """Schema for updating an existing metric."""
    
    name: Optional[str] = Field(
        None,
        description="Name of the metric",
        min_length=1,
        max_length=255
    )
    definition: Optional[str] = Field(
        None,
        description="Formal definition of how this metric is measured",
        min_length=1
    )
    unit: Optional[MetricUnit] = Field(
        None,
        description="Unit of measurement"
    )
    scale_type: Optional[ScaleType] = Field(
        None,
        description="Type of measurement scale"
    )
    collection_method: Optional[CollectionMethod] = Field(
        None,
        description="How the metric data is collected"
    )
    normalization_method: Optional[NormalizationMethod] = Field(
        None,
        description="Normalization method for measurement values"
    )
    weight: Optional[float] = Field(
        None,
        description="Weight of this metric within its criterion (can be negative for penalties)"
    )
    target_value: Optional[float] = Field(
        None,
        description="Target value for this metric"
    )
    direction: Optional[Direction] = Field(
        None,
        description="Optimization direction"
    )


class MetricRead(MetricBase, BaseResponseSchema):
    """Schema for reading a metric."""
    
    evaluation_criterion_id: UUID
