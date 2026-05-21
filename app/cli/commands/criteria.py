"""CLI commands for evaluation criteria."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

criteria = typer.Typer(help="Manage evaluation criteria", no_args_is_help=True)


@criteria.command("list")
def criteria_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all evaluation criteria."""
    resp = get_client(get_server()).get("/domain/evaluation-criteria", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "evaluation_criterion")
        return print_json(data)
    rows = [[d["id"], d["dimension"], d.get("goal_id", ""), str(d.get("weight", 1.0)), d.get("aggregation_strategy", "")] for d in data]
    print_table("Evaluation Criteria", ["ID", "Dimension", "Goal ID", "Weight", "Aggregation"], rows)


@criteria.command("get")
def criteria_get(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """Get a single evaluation criterion."""
    resp = get_client(get_server()).get(f"/domain/evaluation-criteria/{criterion_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "evaluation_criterion")
        return print_json(data)
    print_entity(data, f"Criterion {criterion_id}")


@criteria.command("create")
def criteria_create(
    dimension: str = typer.Option(..., "--dimension", help="Dimension name (e.g. Accuracy, Performance)"),
    description: str = typer.Option(..., "--description", help="What this criterion measures"),
    goal_id: str = typer.Option(..., "--goal-id", help="Parent goal UUID"),
    weight: float = typer.Option(1.0, "--weight", help="Weight in overall evaluation (can be negative)"),
    aggregation_strategy: str = typer.Option("weighted_average", "--aggregation-strategy", help="weighted_average, weighted_sum_normalized, direct_metric_weights, custom"),
):
    """Create a new evaluation criterion. Admin only."""
    body: Dict[str, Any] = {
        "dimension": dimension,
        "description": description,
        "goal_id": goal_id,
        "weight": weight,
        "aggregation_strategy": aggregation_strategy,
    }
    resp = get_client(get_server()).post("/domain/evaluation-criteria", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Criterion")


@criteria.command("update")
def criteria_update(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
    dimension: Optional[str] = typer.Option(None, "--dimension"),
    description: Optional[str] = typer.Option(None, "--description"),
    weight: Optional[float] = typer.Option(None, "--weight"),
    aggregation_strategy: Optional[str] = typer.Option(None, "--aggregation-strategy"),
):
    """Update an evaluation criterion. Admin only."""
    body: Dict[str, Any] = {}
    if dimension is not None:
        body["dimension"] = dimension
    if description is not None:
        body["description"] = description
    if weight is not None:
        body["weight"] = weight
    if aggregation_strategy is not None:
        body["aggregation_strategy"] = aggregation_strategy
    resp = get_client(get_server()).put(f"/domain/evaluation-criteria/{criterion_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Criterion {criterion_id}")


@criteria.command("delete")
def criteria_delete(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an evaluation criterion. Admin only."""
    if not force:
        typer.confirm(f"Delete evaluation criterion {criterion_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/evaluation-criteria/{criterion_id}")
    handle_response(resp)
    typer.echo(f"Deleted evaluation criterion {criterion_id}")


@criteria.command("metrics")
def criteria_metrics(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """List metrics belonging to a criterion."""
    resp = get_client(get_server()).get(f"/domain/evaluation-criteria/{criterion_id}/metrics")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "metric")
        return print_json(data)
    rows = [[d["id"], d["name"], d["unit"], str(d.get("weight", 1.0)), d.get("direction", "")] for d in data]
    print_table(f"Metrics for Criterion {criterion_id}", ["ID", "Name", "Unit", "Weight", "Direction"], rows)


@criteria.command("scores")
def criteria_scores(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """List aggregated scores for a criterion."""
    resp = get_client(get_server()).get(f"/domain/evaluation-criteria/{criterion_id}/aggregated-scores")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "aggregated_score")
        return print_json(data)
    rows = [[d["id"], str(d["score"]), d.get("tool_config_id", ""), str(d.get("timestamp", ""))] for d in data]
    print_table(f"Scores for Criterion {criterion_id}", ["ID", "Score", "Tool Config ID", "Timestamp"], rows)


@criteria.command("recalculate")
def criteria_recalculate(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """Recalculate all aggregated scores for a criterion. Admin only."""
    resp = get_client(get_server()).post(f"/domain/evaluation-criteria/{criterion_id}/recalculate-scores")
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    typer.echo(f"Recalculated {len(data)} scores for criterion {criterion_id}")
    rows = [[d["id"], str(d["score"]), d.get("tool_config_id", "")] for d in data]
    print_table("Recalculated Scores", ["ID", "Score", "Tool Config ID"], rows)
