"""CLI commands for measurements."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

measurements = typer.Typer(help="Manage measurements", no_args_is_help=True)


@measurements.command("list")
def measurements_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all measurements."""
    resp = get_client(get_server()).get("/domain/measurements", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "measurement")
        return print_json(data)
    rows = [[d["id"], str(d["value"]), d.get("metric_id", ""), d.get("llm_tool_configuration_id", ""), d.get("evaluator", ""), str(d.get("date", ""))] for d in data]
    print_table("Measurements", ["ID", "Value", "Metric ID", "Tool Config ID", "Evaluator", "Date"], rows)


@measurements.command("get")
def measurements_get(
    measurement_id: str = typer.Argument(..., help="Measurement UUID"),
):
    """Get a single measurement."""
    resp = get_client(get_server()).get(f"/domain/measurements/{measurement_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "measurement")
        return print_json(data)
    print_entity(data, f"Measurement {measurement_id}")


@measurements.command("create")
def measurements_create(
    value: float = typer.Option(..., "--value", help="The measured value"),
    metric_id: str = typer.Option(..., "--metric-id", help="Metric UUID being measured"),
    llm_tool_configuration_id: str = typer.Option(..., "--llm-tool-configuration-id", help="Tool config UUID"),
    evaluator: Optional[str] = typer.Option(None, "--evaluator", help="Person/system that performed the evaluation"),
    notes: Optional[str] = typer.Option(None, "--notes", help="Additional notes"),
    normalized_value: Optional[float] = typer.Option(None, "--normalized-value", help="Normalized value for comparison"),
):
    """Create a new measurement. Any authenticated user."""
    body: Dict[str, Any] = {
        "value": value,
        "metric_id": metric_id,
        "llm_tool_configuration_id": llm_tool_configuration_id,
    }
    if evaluator is not None:
        body["evaluator"] = evaluator
    if notes is not None:
        body["notes"] = notes
    if normalized_value is not None:
        body["normalized_value"] = normalized_value
    resp = get_client(get_server()).post("/domain/measurements", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Measurement")


@measurements.command("update")
def measurements_update(
    measurement_id: str = typer.Argument(..., help="Measurement UUID"),
    value: Optional[float] = typer.Option(None, "--value"),
    evaluator: Optional[str] = typer.Option(None, "--evaluator"),
    notes: Optional[str] = typer.Option(None, "--notes"),
    normalized_value: Optional[float] = typer.Option(None, "--normalized-value"),
):
    """Update a measurement. Admin only."""
    body: Dict[str, Any] = {}
    if value is not None:
        body["value"] = value
    if evaluator is not None:
        body["evaluator"] = evaluator
    if notes is not None:
        body["notes"] = notes
    if normalized_value is not None:
        body["normalized_value"] = normalized_value
    resp = get_client(get_server()).put(f"/domain/measurements/{measurement_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Measurement {measurement_id}")


@measurements.command("delete")
def measurements_delete(
    measurement_id: str = typer.Argument(..., help="Measurement UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a measurement. Admin only."""
    if not force:
        typer.confirm(f"Delete measurement {measurement_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/measurements/{measurement_id}")
    handle_response(resp)
    typer.echo(f"Deleted measurement {measurement_id}")
