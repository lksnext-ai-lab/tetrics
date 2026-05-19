"""
Domain models for the software measurement framework.
Based on the reduced domain model with 7 core entities.
"""

from app.models.domain.enums import (
    ScaleType,
    CollectionMethod,
    Direction,
    AggregationStrategy,
    MetricUnit,
    NormalizationMethod,
)
from app.models.domain.evaluation_program import EvaluationProgram
from app.models.domain.goal import Goal
from app.models.domain.evaluation_criterion import EvaluationCriterion
from app.models.domain.metric import Metric
from app.models.domain.llm_tool_configuration import LLMToolConfiguration
from app.models.domain.measurement import Measurement
from app.models.domain.aggregated_score import AggregatedScore

__all__ = [
    # Enums
    "ScaleType",
    "CollectionMethod",
    "Direction",
    "AggregationStrategy",
    "MetricUnit",
    "NormalizationMethod",
    # Models
    "EvaluationProgram",
    "Goal",
    "EvaluationCriterion",
    "Metric",
    "LLMToolConfiguration",
    "Measurement",
    "AggregatedScore",
]
