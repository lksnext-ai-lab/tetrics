"""CLI commands for aggregated scores."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

scores = typer.Typer(help="Manage aggregated scores", no_args_is_help=True)


@scores.command("list")
def scores_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all aggregated scores."""
    resp = get_client(get_server()).get("/domain/aggregated-scores", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "aggregated_score")
        return print_json(data)
    rows = [[d["id"], str(d["score"]), d.get("criterion_id", ""), d.get("tool_config_id", ""), str(d.get("timestamp", ""))] for d in data]
    print_table("Aggregated Scores", ["ID", "Score", "Criterion ID", "Tool Config ID", "Timestamp"], rows)


@scores.command("get")
def scores_get(
    score_id: str = typer.Argument(..., help="Score UUID"),
):
    """Get a single aggregated score."""
    resp = get_client(get_server()).get(f"/domain/aggregated-scores/{score_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "aggregated_score")
        return print_json(data)
    print_entity(data, f"Score {score_id}")


@scores.command("create")
def scores_create(
    score: float = typer.Option(..., "--score", help="The aggregated score value"),
    criterion_id: str = typer.Option(..., "--criterion-id", help="Evaluation criterion UUID"),
    tool_config_id: str = typer.Option(..., "--tool-config-id", help="LLM tool configuration UUID"),
    component_metrics: str = typer.Option("{}", "--component-metrics", help="JSON object of metric contributions"),
):
    """Create a new aggregated score. Admin only."""
    body: Dict[str, Any] = {
        "score": score,
        "criterion_id": criterion_id,
        "tool_config_id": tool_config_id,
        "component_metrics": _json.loads(component_metrics),
    }
    resp = get_client(get_server()).post("/domain/aggregated-scores", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Aggregated Score")


@scores.command("update")
def scores_update(
    score_id: str = typer.Argument(..., help="Score UUID"),
    score: Optional[float] = typer.Option(None, "--score"),
    component_metrics: Optional[str] = typer.Option(None, "--component-metrics", help="JSON object"),
):
    """Update an aggregated score. Admin only."""
    body: Dict[str, Any] = {}
    if score is not None:
        body["score"] = score
    if component_metrics is not None:
        body["component_metrics"] = _json.loads(component_metrics)
    resp = get_client(get_server()).put(f"/domain/aggregated-scores/{score_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Score {score_id}")


@scores.command("delete")
def scores_delete(
    score_id: str = typer.Argument(..., help="Score UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an aggregated score. Admin only."""
    if not force:
        typer.confirm(f"Delete aggregated score {score_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/aggregated-scores/{score_id}")
    handle_response(resp)
    typer.echo(f"Deleted aggregated score {score_id}")
