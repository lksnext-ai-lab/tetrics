"""Shared constants for CLI output filtering and metric enums."""

from typing import Dict, List

# Nested relation keys that the API may return — stripped from all CLI output
# to keep responses focused and LLM-friendly. Use the nested subcommands
# (e.g. `programs goals <id>`) to fetch related entities explicitly.
RELATION_KEYS = frozenset({
    "goals",
    "evaluation_criteria",
    "metrics",
    "measurements",
    "aggregated_scores",
})

# Essential fields per entity type for --json output without --verbose.
# Keeps responses compact (id + name/title) so AI consumers aren't
# overwhelmed. Pass --verbose to get every field including timestamps.
SUMMARY_FIELDS: Dict[str, List[str]] = {
    "evaluation_program": ["id", "organization_context", "responsible_team"],
    "goal": ["id", "purpose"],
    "evaluation_criterion": ["id", "dimension", "weight", "aggregation_strategy"],
    "metric": ["id", "name", "unit", "direction"],
    "llm_tool_configuration": ["id", "tool_name", "model_version"],
    "measurement": ["id", "value", "metric_id", "llm_tool_configuration_id"],
    "aggregated_score": ["id", "score", "criterion_id", "tool_config_id"],
    "user": ["id", "email", "full_name"],
}

# Metric field enumerations — used in help text and validation.
METRIC_UNITS = ["Percent", "Cardinal"]
SCALE_TYPES = ["nominal", "ordinal", "interval", "ratio"]
COLLECTION_METHODS = ["automated", "manual", "hybrid"]
NORMALIZATION_METHODS = ["none", "max", "min"]
DIRECTIONS = ["higher_is_better", "lower_is_better", "target_value"]
