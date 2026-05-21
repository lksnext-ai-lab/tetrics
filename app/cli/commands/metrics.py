"""CLI commands for metrics."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.constants import COLLECTION_METHODS, DIRECTIONS, METRIC_UNITS, NORMALIZATION_METHODS, SCALE_TYPES
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

metrics = typer.Typer(help="Manage metrics", no_args_is_help=True)


@metrics.command("list")
def metrics_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all metrics."""
    resp = get_client(get_server()).get("/domain/metrics", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "metric")
        return print_json(data)
    rows = [[d["id"], d["name"], d["unit"], str(d.get("weight", 1.0)), d.get("direction", "")] for d in data]
    print_table("Metrics", ["ID", "Name", "Unit", "Weight", "Direction"], rows)


@metrics.command("get")
def metrics_get(
    metric_id: str = typer.Argument(..., help="Metric UUID"),
):
    """Get a single metric."""
    resp = get_client(get_server()).get(f"/domain/metrics/{metric_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "metric")
        return print_json(data)
    print_entity(data, f"Metric {metric_id}")


@metrics.command("create")
def metrics_create(
    name: str = typer.Option(..., "--name", help="Metric name"),
    definition: str = typer.Option(..., "--definition", help="Formal definition of how this is measured"),
    unit: str = typer.Option(..., "--unit", help=f"One of: {METRIC_UNITS}"),
    scale_type: str = typer.Option(..., "--scale-type", help=f"One of: {SCALE_TYPES}"),
    collection_method: str = typer.Option(..., "--collection-method", help=f"One of: {COLLECTION_METHODS}"),
    direction: str = typer.Option(..., "--direction", help=f"One of: {DIRECTIONS}"),
    evaluation_criterion_id: str = typer.Option(..., "--evaluation-criterion-id", help="Parent criterion UUID"),
    weight: float = typer.Option(1.0, "--weight", help="Metric weight (can be negative for penalties)"),
    target_value: Optional[float] = typer.Option(None, "--target-value", help="Target value if applicable"),
    normalization_method: str = typer.Option("none", "--normalization-method", help=f"One of: {NORMALIZATION_METHODS}"),
):
    """Create a new metric. Admin only."""
    body: Dict[str, Any] = {
        "name": name,
        "definition": definition,
        "unit": unit,
        "scale_type": scale_type,
        "collection_method": collection_method,
        "direction": direction,
        "evaluation_criterion_id": evaluation_criterion_id,
        "weight": weight,
        "normalization_method": normalization_method,
    }
    if target_value is not None:
        body["target_value"] = target_value
    resp = get_client(get_server()).post("/domain/metrics", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Metric")


@metrics.command("update")
def metrics_update(
    metric_id: str = typer.Argument(..., help="Metric UUID"),
    name: Optional[str] = typer.Option(None, "--name"),
    definition: Optional[str] = typer.Option(None, "--definition"),
    unit: Optional[str] = typer.Option(None, "--unit"),
    scale_type: Optional[str] = typer.Option(None, "--scale-type"),
    collection_method: Optional[str] = typer.Option(None, "--collection-method"),
    direction: Optional[str] = typer.Option(None, "--direction"),
    weight: Optional[float] = typer.Option(None, "--weight"),
    target_value: Optional[float] = typer.Option(None, "--target-value"),
    normalization_method: Optional[str] = typer.Option(None, "--normalization-method"),
):
    """Update a metric. Admin only."""
    body: Dict[str, Any] = {}
    if name is not None:
        body["name"] = name
    if definition is not None:
        body["definition"] = definition
    if unit is not None:
        body["unit"] = unit
    if scale_type is not None:
        body["scale_type"] = scale_type
    if collection_method is not None:
        body["collection_method"] = collection_method
    if direction is not None:
        body["direction"] = direction
    if weight is not None:
        body["weight"] = weight
    if target_value is not None:
        body["target_value"] = target_value
    if normalization_method is not None:
        body["normalization_method"] = normalization_method
    resp = get_client(get_server()).put(f"/domain/metrics/{metric_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Metric {metric_id}")


@metrics.command("delete")
def metrics_delete(
    metric_id: str = typer.Argument(..., help="Metric UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a metric. Admin only."""
    if not force:
        typer.confirm(f"Delete metric {metric_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/metrics/{metric_id}")
    handle_response(resp)
    typer.echo(f"Deleted metric {metric_id}")
