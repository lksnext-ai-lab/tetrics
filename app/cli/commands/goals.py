"""CLI commands for goals."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

goals = typer.Typer(help="Manage goals", no_args_is_help=True)


@goals.command("list")
def goals_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all goals."""
    resp = get_client(get_server()).get("/domain/goals", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "goal")
        return print_json(data)
    rows = [[d["id"], d["purpose"], d["focus"], d["viewpoint"], d.get("evaluation_program_id", "")] for d in data]
    print_table("Goals", ["ID", "Purpose", "Focus", "Viewpoint", "Program ID"], rows)


@goals.command("get")
def goals_get(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
):
    """Get a single goal."""
    resp = get_client(get_server()).get(f"/domain/goals/{goal_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "goal")
        return print_json(data)
    print_entity(data, f"Goal {goal_id}")


@goals.command("create")
def goals_create(
    purpose: str = typer.Option(..., "--purpose", help="Purpose of this goal"),
    focus: str = typer.Option(..., "--focus", help="Focus area"),
    viewpoint: str = typer.Option(..., "--viewpoint", help="Viewpoint for evaluation"),
    evaluation_program_id: str = typer.Option(..., "--evaluation-program-id", help="Parent program UUID"),
    context: Optional[str] = typer.Option(None, "--context", help="Additional context (Markdown)"),
):
    """Create a new goal. Admin only."""
    body: Dict[str, Any] = {
        "purpose": purpose,
        "focus": focus,
        "viewpoint": viewpoint,
        "evaluation_program_id": evaluation_program_id,
    }
    if context is not None:
        body["context"] = context
    resp = get_client(get_server()).post("/domain/goals", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Goal")


@goals.command("update")
def goals_update(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
    purpose: Optional[str] = typer.Option(None, "--purpose"),
    focus: Optional[str] = typer.Option(None, "--focus"),
    viewpoint: Optional[str] = typer.Option(None, "--viewpoint"),
    context: Optional[str] = typer.Option(None, "--context"),
):
    """Update a goal. Admin only."""
    body: Dict[str, Any] = {}
    if purpose is not None:
        body["purpose"] = purpose
    if focus is not None:
        body["focus"] = focus
    if viewpoint is not None:
        body["viewpoint"] = viewpoint
    if context is not None:
        body["context"] = context
    resp = get_client(get_server()).put(f"/domain/goals/{goal_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Goal {goal_id}")


@goals.command("delete")
def goals_delete(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a goal. Admin only."""
    if not force:
        typer.confirm(f"Delete goal {goal_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/goals/{goal_id}")
    handle_response(resp)
    typer.echo(f"Deleted goal {goal_id}")


@goals.command("criteria")
def goals_criteria(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
):
    """List evaluation criteria belonging to a goal."""
    resp = get_client(get_server()).get(f"/domain/goals/{goal_id}/evaluation-criteria")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "evaluation_criterion")
        return print_json(data)
    rows = [[d["id"], d["dimension"], str(d.get("weight", 1.0)), d.get("aggregation_strategy", "")] for d in data]
    print_table(f"Criteria for Goal {goal_id}", ["ID", "Dimension", "Weight", "Aggregation"], rows)
