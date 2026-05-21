"""CLI commands for evaluation programs."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

programs = typer.Typer(help="Manage evaluation programs", no_args_is_help=True)


@programs.command("list")
def programs_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all evaluation programs."""
    resp = get_client(get_server()).get("/domain/evaluation-programs", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "evaluation_program")
        return print_json(data)
    rows = [[d["id"], d["organization_context"], str(d["time_period"]), d["responsible_team"]] for d in data]
    print_table("Evaluation Programs", ["ID", "Context", "Time Period", "Team"], rows)


@programs.command("get")
def programs_get(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
):
    """Get a single evaluation program."""
    resp = get_client(get_server()).get(f"/domain/evaluation-programs/{program_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "evaluation_program")
        return print_json(data)
    print_entity(data, f"Program {program_id}")


@programs.command("create")
def programs_create(
    organization_context: str = typer.Option(..., "--organization-context", help="Organizational context (e.g. company name)"),
    time_period: str = typer.Option(..., "--time-period", help="ISO datetime (e.g. 2026-06-01T00:00:00)"),
    responsible_team: str = typer.Option(..., "--responsible-team", help="Team responsible"),
    validity_period: Optional[int] = typer.Option(None, "--validity-period", help="Validity in days"),
    reevaluation_triggers: Optional[str] = typer.Option(None, "--reevaluation-triggers", help="JSON list of trigger strings"),
):
    """Create a new evaluation program. Admin only."""
    body: Dict[str, Any] = {
        "organization_context": organization_context,
        "time_period": time_period,
        "responsible_team": responsible_team,
    }
    if validity_period is not None:
        body["validity_period"] = validity_period
    if reevaluation_triggers:
        body["reevaluation_triggers"] = _json.loads(reevaluation_triggers)
    resp = get_client(get_server()).post("/domain/evaluation-programs", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Program")


@programs.command("update")
def programs_update(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
    organization_context: Optional[str] = typer.Option(None, "--organization-context"),
    time_period: Optional[str] = typer.Option(None, "--time-period", help="ISO datetime"),
    responsible_team: Optional[str] = typer.Option(None, "--responsible-team"),
    validity_period: Optional[int] = typer.Option(None, "--validity-period"),
    reevaluation_triggers: Optional[str] = typer.Option(None, "--reevaluation-triggers", help="JSON list of strings"),
):
    """Update an evaluation program. Admin only."""
    body: Dict[str, Any] = {}
    if organization_context is not None:
        body["organization_context"] = organization_context
    if time_period is not None:
        body["time_period"] = time_period
    if responsible_team is not None:
        body["responsible_team"] = responsible_team
    if validity_period is not None:
        body["validity_period"] = validity_period
    if reevaluation_triggers is not None:
        body["reevaluation_triggers"] = _json.loads(reevaluation_triggers)
    resp = get_client(get_server()).put(f"/domain/evaluation-programs/{program_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Program {program_id}")


@programs.command("delete")
def programs_delete(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an evaluation program. Admin only."""
    if not force:
        typer.confirm(f"Delete evaluation program {program_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/evaluation-programs/{program_id}")
    handle_response(resp)
    typer.echo(f"Deleted evaluation program {program_id}")


@programs.command("goals")
def programs_goals(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
):
    """List goals belonging to an evaluation program."""
    resp = get_client(get_server()).get(f"/domain/evaluation-programs/{program_id}/goals")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "goal")
        return print_json(data)
    rows = [[d["id"], d["purpose"], d["focus"], d["viewpoint"]] for d in data]
    print_table(f"Goals for Program {program_id}", ["ID", "Purpose", "Focus", "Viewpoint"], rows)
