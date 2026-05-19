"""
Enumerations used across domain models.
"""
from enum import Enum


class ScaleType(str, Enum):
    """Types of measurement scales."""
    NOMINAL = "nominal"
    ORDINAL = "ordinal"
    INTERVAL = "interval"
    RATIO = "ratio"


class CollectionMethod(str, Enum):
    """Methods for collecting measurements."""
    AUTOMATED = "automated"
    MANUAL = "manual"
    HYBRID = "hybrid"


class Direction(str, Enum):
    """Direction for target values."""
    HIGHER_IS_BETTER = "higher_is_better"
    LOWER_IS_BETTER = "lower_is_better"
    TARGET_VALUE = "target_value"


class AggregationStrategy(str, Enum):
    """Strategy for aggregating metrics into criterion scores."""
    WEIGHTED_AVERAGE = "weighted_average"  # Standard: avg(metrics) * criterion_weight
    WEIGHTED_SUM_NORMALIZED = "weighted_sum_normalized"  # Each metric weight * normalized value
    DIRECT_METRIC_WEIGHTS = "direct_metric_weights"  # Metric weights flow directly, criterion weight bypassed
    CUSTOM = "custom"  # Custom aggregation logic


class NormalizationMethod(str, Enum):
    """Method for normalizing metric measurement values before aggregation."""
    NONE = "none"  # Raw value, no normalization
    MAX = "max"    # value / max(all active measurements for this metric)
    MIN = "min"    # value / min(all active measurements for this metric)


class MetricUnit(str, Enum):
    """Units for metric measurements."""
    PERCENT = "Percent"
    CARDINAL = "Cardinal"
