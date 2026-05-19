"""
Score aggregation service for calculating criterion scores from measurements.

This module implements different aggregation strategies to combine multiple
metric measurements into a single criterion score. It supports weighted
averages, normalized weighted sums, and custom aggregation logic.
"""
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.domain import (
    AggregatedScore,
    AggregationStrategy,
    Direction,
    EvaluationCriterion,
    Measurement,
    Metric,
    MetricUnit,
    NormalizationMethod,
)
from app.repositories import (
    AggregatedScoreRepository,
    EvaluationCriterionRepository,
    MeasurementRepository,
    MetricRepository,
)
from app.repositories.llm_tool_configuration import LLMToolConfigurationRepository
from app.schemas.aggregated_score import AggregatedScoreCreate


# =============================================================================
# Constants
# =============================================================================

ZERO_TOLERANCE = 1e-9  # For floating point comparisons


# =============================================================================
# Score Aggregation Service
# =============================================================================


class ScoreAggregationService:
    """
    Service for calculating aggregated criterion scores from metric measurements.
    
    This service handles:
    - Retrieving measurements for a criterion and tool configuration
    - Applying the appropriate aggregation strategy
    - Storing and updating aggregated scores
    - Triggering recalculations when measurements change
    """
    
    def __init__(self, db: Session):
        """
        Initialize the aggregation service.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.criterion_repo = EvaluationCriterionRepository(db)
        self.metric_repo = MetricRepository(db)
        self.measurement_repo = MeasurementRepository(db)
        self.score_repo = AggregatedScoreRepository(db)
        self.tool_config_repo = LLMToolConfigurationRepository(db)
    
    # =========================================================================
    # Public API
    # =========================================================================
    
    def calculate_and_store_score(
        self,
        criterion_id: UUID,
        tool_config_id: UUID
    ) -> AggregatedScore:
        """
        Calculate and store an aggregated score for a criterion and tool configuration.
        
        Args:
            criterion_id: ID of the evaluation criterion
            tool_config_id: ID of the LLM tool configuration
            
        Returns:
            The created or updated AggregatedScore
            
        Raises:
            ValidationError: If required data is missing or invalid
        """
        criterion = self._get_criterion_or_raise(criterion_id)
        metrics = self._get_metrics_or_raise(criterion_id)
        measurements_by_metric = self._collect_measurements(metrics, tool_config_id)
        
        if not measurements_by_metric:
            raise ValidationError(
                f"No measurements found for criterion {criterion_id} "
                f"and tool configuration {tool_config_id}"
            )
        
        # Calculate the aggregated score
        score, component_metrics = self._apply_aggregation_strategy(
            criterion, metrics, measurements_by_metric
        )
        
        # Store or update the score
        aggregated_score = self._upsert_aggregated_score(
            criterion_id, tool_config_id, score, component_metrics
        )
        
        # Link measurements to the score (only for this tool configuration)
        self._link_measurements_to_score(measurements_by_metric, aggregated_score.id, tool_config_id)
        
        return aggregated_score
    
    def recalculate_all_scores_for_criterion(
        self,
        criterion_id: UUID
    ) -> List[AggregatedScore]:
        """
        Recalculate all aggregated scores for a criterion across all tool configurations.

        This is useful when:
        - A new measurement is added
        - A metric definition changes
        - The aggregation strategy is updated

        Args:
            criterion_id: ID of the criterion to recalculate

        Returns:
            List of recalculated AggregatedScore instances
        """
        # Validate criterion exists
        self._get_criterion_or_raise(criterion_id)

        # Get metrics - if none exist, return empty list (nothing to calculate)
        metrics = self.metric_repo.get_by_criterion(criterion_id)
        if not metrics:
            return []

        # Find all tool configurations with measurements for this criterion
        tool_config_ids = self._get_tool_config_ids_for_criterion(metrics)

        # Recalculate for each configuration
        recalculated_scores = []
        affected_tool_configs = set()
        for tool_config_id in tool_config_ids:
            try:
                score = self.calculate_and_store_score(criterion_id, tool_config_id)
                recalculated_scores.append(score)
                affected_tool_configs.add(tool_config_id)
            except ValidationError:
                # Skip configurations with incomplete data
                continue

        # Update total scores for all affected tool configurations
        for tool_config_id in affected_tool_configs:
            self.calculate_and_update_tool_total_score(tool_config_id)

        return recalculated_scores
    
    # =========================================================================
    # Data Retrieval
    # =========================================================================
    
    def _get_criterion_or_raise(self, criterion_id: UUID) -> EvaluationCriterion:
        """Get criterion or raise validation error."""
        criterion = self.criterion_repo.get_by_id(criterion_id)
        if not criterion:
            raise ValidationError(f"Criterion {criterion_id} not found")
        return criterion
    
    def _get_metrics_or_raise(self, criterion_id: UUID) -> List[Metric]:
        """Get metrics for criterion or raise validation error."""
        metrics = self.metric_repo.get_by_criterion(criterion_id)
        if not metrics:
            raise ValidationError(f"No metrics found for criterion {criterion_id}")
        return metrics
    
    def _collect_measurements(
        self,
        metrics: List[Metric],
        tool_config_id: UUID
    ) -> Dict[UUID, List[Measurement]]:
        """
        Collect all measurements for the given metrics and tool configuration.
        
        Returns:
            Dictionary mapping metric IDs to their measurements
        """
        measurements_by_metric = {}
        for metric in metrics:
            measurements = self._get_measurements_for_metric_and_tool(
                metric.id, tool_config_id
            )
            if measurements:
                measurements_by_metric[metric.id] = measurements
        return measurements_by_metric
    
    def _get_measurements_for_metric_and_tool(
        self,
        metric_id: UUID,
        tool_config_id: UUID
    ) -> List[Measurement]:
        """Get all active measurements for a specific metric and tool configuration."""
        return self.db.query(Measurement).filter(
            Measurement.metric_id == metric_id,
            Measurement.llm_tool_configuration_id == tool_config_id,
            Measurement.is_active == True
        ).all()
    
    def _get_min_max_for_metric(self, metric_id: UUID) -> Tuple[float, float]:
        """Get the min and max values for a metric across all active measurements in a single query."""
        result = self.db.query(
            func.min(Measurement.value),
            func.max(Measurement.value)
        ).filter(
            Measurement.metric_id == metric_id,
            Measurement.is_active == True
        ).first()
        min_val = result[0] if result[0] is not None else 0.0
        max_val = result[1] if result[1] is not None else 0.0
        return (min_val, max_val)
    
    def _get_tool_config_ids_for_criterion(self, metrics: List[Metric]) -> set[UUID]:
        """Get all unique tool configuration IDs that have measurements for these metrics."""
        tool_config_ids = set()
        for metric in metrics:
            configs = self.db.query(Measurement.llm_tool_configuration_id).filter(
                Measurement.metric_id == metric.id,
                Measurement.is_active == True
            ).distinct().all()
            tool_config_ids.update(config[0] for config in configs)
        return tool_config_ids
    
    # =========================================================================
    # Aggregation Strategy Dispatcher
    # =========================================================================
    
    def _apply_aggregation_strategy(
        self,
        criterion: EvaluationCriterion,
        metrics: List[Metric],
        measurements_by_metric: Dict[UUID, List[Measurement]]
    ) -> Tuple[float, Dict]:
        """
        Apply the appropriate aggregation strategy based on the criterion configuration.
        
        Returns:
            Tuple of (aggregated_score, component_metrics_breakdown)
        """
        strategy = self._parse_aggregation_strategy(criterion.aggregation_strategy)
        
        strategy_handlers = {
            AggregationStrategy.WEIGHTED_AVERAGE: self._calculate_weighted_average,
            AggregationStrategy.WEIGHTED_SUM_NORMALIZED: self._calculate_weighted_sum_normalized,
            AggregationStrategy.DIRECT_METRIC_WEIGHTS: self._calculate_direct_metric_weights,
            AggregationStrategy.CUSTOM: self._calculate_custom,
        }
        
        handler = strategy_handlers.get(strategy)
        if not handler:
            raise ValidationError(f"Unknown aggregation strategy: {strategy}")
        
        return handler(criterion, metrics, measurements_by_metric)
    
    def _parse_aggregation_strategy(self, strategy) -> AggregationStrategy:
        """Parse aggregation strategy, handling both enum and string values."""
        if isinstance(strategy, AggregationStrategy):
            return strategy
        
        if isinstance(strategy, str):
            try:
                return AggregationStrategy(strategy)
            except ValueError:
                raise ValidationError(f"Invalid aggregation strategy: {strategy}")
        
        raise ValidationError(f"Unknown aggregation strategy type: {type(strategy)}")
    
    # =========================================================================
    # Aggregation Strategy Implementations
    # =========================================================================
    
    def _calculate_weighted_average(
        self,
        criterion: EvaluationCriterion,
        metrics: List[Metric],
        measurements_by_metric: Dict[UUID, List[Measurement]]
    ) -> Tuple[float, Dict]:
        """
        Weighted average of normalized metric values.

        Each metric is normalized per its normalization_method before averaging.

        Formula: criterion_weight × (Σ(normalized_value × metric_weight) / Σ(metric_weight))
        """
        weighted_sum = 0.0
        total_weight = 0.0
        component_metrics = {}

        for metric in metrics:
            if metric.id not in measurements_by_metric:
                continue

            measurements = measurements_by_metric[metric.id]
            latest_measurement = max(measurements, key=lambda m: m.date)
            raw_value = latest_measurement.value
            normalized_value = self._normalize_metric_value(metric, raw_value)

            weighted_sum += normalized_value * metric.weight
            total_weight += metric.weight

            component_metrics[str(metric.id)] = {
                "name": metric.name,
                "raw_value": raw_value,
                "normalized_value": normalized_value,
                "weight": metric.weight,
                "contribution": normalized_value * metric.weight
            }

        if total_weight < ZERO_TOLERANCE:
            raise ValidationError("Total metric weight is zero")

        weighted_average = weighted_sum / total_weight
        score = weighted_average * criterion.weight

        return score, component_metrics
    
    def _calculate_weighted_sum_normalized(
        self,
        criterion: EvaluationCriterion,
        metrics: List[Metric],
        measurements_by_metric: Dict[UUID, List[Measurement]]
    ) -> Tuple[float, Dict]:
        """
        Weighted sum of normalized metrics, multiplied by criterion weight.

        Each metric is normalized per its normalization_method, then:
        contribution = metric.weight * normalized_value

        Negative weights encode penalties — no direction-based inversion needed.

        Formula: criterion_weight × Σ(metric_weight × normalized_value)
        """
        component_metrics = {}
        total_score = 0.0

        for metric in metrics:
            if metric.id not in measurements_by_metric:
                continue

            measurements = measurements_by_metric[metric.id]
            latest_measurement = max(measurements, key=lambda m: m.date)
            current_value = latest_measurement.value

            normalized_value = self._normalize_metric_value(metric, current_value)
            contribution = metric.weight * normalized_value

            total_score += contribution

            component_metrics[str(metric.id)] = {
                "name": metric.name,
                "raw_value": current_value,
                "normalized_value": normalized_value,
                "weight": metric.weight,
                "contribution": contribution
            }

        score = total_score * criterion.weight
        return score, component_metrics

    def _calculate_direct_metric_weights(
        self,
        criterion: EvaluationCriterion,
        metrics: List[Metric],
        measurements_by_metric: Dict[UUID, List[Measurement]]
    ) -> Tuple[float, Dict]:
        """
        Direct metric weights strategy — criterion weight is bypassed.

        Each metric's weight contributes directly to the total score with no
        criterion-level multiplier. Negative weights encode penalties.

        Formula: Σ(metric_weight × normalized_value)
        """
        component_metrics = {}
        total_score = 0.0

        for metric in metrics:
            if metric.id not in measurements_by_metric:
                continue

            measurements = measurements_by_metric[metric.id]
            latest_measurement = max(measurements, key=lambda m: m.date)
            current_value = latest_measurement.value

            normalized_value = self._normalize_metric_value(metric, current_value)
            contribution = metric.weight * normalized_value

            total_score += contribution

            component_metrics[str(metric.id)] = {
                "name": metric.name,
                "raw_value": current_value,
                "normalized_value": normalized_value,
                "weight": metric.weight,
                "contribution": contribution
            }

        return total_score, component_metrics

    def _calculate_custom(
        self,
        criterion: EvaluationCriterion,
        metrics: List[Metric],
        measurements_by_metric: Dict[UUID, List[Measurement]]
    ) -> Tuple[float, Dict]:
        """
        Custom aggregation strategy.

        Delegates to direct_metric_weights by default.
        Can be extended for criterion-specific logic based on dimension.
        """
        # Future extension point: criterion.dimension-based routing
        return self._calculate_direct_metric_weights(
            criterion, metrics, measurements_by_metric
        )
    
    # =========================================================================
    # Normalization
    # =========================================================================

    def _normalize_metric_value(self, metric: Metric, value: float) -> float:
        """
        Normalize a metric value based on the metric's normalization_method.

        - none: return raw value unchanged
        - max:  value / max(all active measurements for this metric)
        - min:  value / min(all active measurements for this metric)
        """
        method = self._get_normalization_method_string(metric)

        if method == NormalizationMethod.NONE:
            return value

        min_val, max_val = self._get_min_max_for_metric(metric.id)

        if method == NormalizationMethod.MAX:
            if max_val < ZERO_TOLERANCE:
                return 0.0
            return value / max_val

        if method == NormalizationMethod.MIN:
            if min_val < ZERO_TOLERANCE:
                return 0.0
            return value / min_val

        return value

    def _get_normalization_method_string(self, metric: Metric) -> str:
        """Get normalization method as string, handling both enum and string types."""
        if hasattr(metric.normalization_method, 'value'):
            return metric.normalization_method.value
        return str(metric.normalization_method)
    
    # =========================================================================
    # Score Storage
    # =========================================================================
    
    def _upsert_aggregated_score(
        self,
        criterion_id: UUID,
        tool_config_id: UUID,
        score: float,
        component_metrics: Dict
    ) -> AggregatedScore:
        """
        Create or update an aggregated score.
        
        If a score already exists for this criterion/tool combination,
        update it. Otherwise, create a new one.
        """
        existing_scores = self.score_repo.get_by_criterion_and_tool(
            criterion_id, tool_config_id
        )
        
        if existing_scores:
            # Update the most recent score
            aggregated_score = existing_scores[0]
            aggregated_score.score = score
            aggregated_score.timestamp = datetime.now()
            aggregated_score.component_metrics = component_metrics
            self.db.commit()
            self.db.refresh(aggregated_score)
        else:
            # Create new score
            score_data = AggregatedScoreCreate(
                criterion_id=criterion_id,
                tool_config_id=tool_config_id,
                score=score,
                component_metrics=component_metrics
            )
            aggregated_score = self.score_repo.create(score_data)
        
        return aggregated_score
    
    def _link_measurements_to_score(
        self,
        measurements_by_metric: Dict[UUID, List[Measurement]],
        aggregated_score_id: UUID,
        tool_config_id: UUID
    ) -> None:
        """
        Link measurements used in the calculation to the aggregated score.
        
        Note: measurements_by_metric should already be filtered by tool_config_id
        from _collect_measurements, but we verify to ensure data integrity.
        """
        for measurements in measurements_by_metric.values():
            for measurement in measurements:
                # Safety check: only link measurements for this specific tool configuration
                if measurement.llm_tool_configuration_id == tool_config_id:
                    measurement.aggregated_score_id = aggregated_score_id
        self.db.commit()
    
    # =========================================================================
    # Total Score Calculation for LLM Tool Configuration
    # =========================================================================
    
    def calculate_and_update_tool_total_score(
        self,
        tool_config_id: UUID
    ) -> Optional[float]:
        """
        Calculate and update the total aggregated score for an LLM tool configuration.
        
        This method sums all aggregated scores (which are already weighted by criterion weight)
        for the given tool configuration and updates the total_score field.
        
        Args:
            tool_config_id: ID of the LLM tool configuration
            
        Returns:
            The calculated total score, or None if no scores exist
        """
        # Get all aggregated scores for this tool configuration
        aggregated_scores = self.score_repo.get_by_tool_configuration(tool_config_id)
        
        if not aggregated_scores:
            # No scores yet, set total_score to None
            self.tool_config_repo.update_total_score(tool_config_id, 0.0)
            return None
        
        # Sum all the aggregated scores (they're already weighted)
        total_score = sum(score.score for score in aggregated_scores)
        
        # Update the tool configuration with the total score
        self.tool_config_repo.update_total_score(tool_config_id, total_score)
        
        print(
            f"[TOTAL-SCORE] Updated total score for tool config {tool_config_id}: "
            f"{total_score} (from {len(aggregated_scores)} criteria)"
        )
        
        return total_score
