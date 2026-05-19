#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tetrics CLI — manage your evaluation framework from the terminal.

    python cli.py programs list
    python cli.py programs get <id>
    python cli.py goals create --purpose "..." --focus "..." --viewpoint "..." --evaluation-program-id <uuid>

Auth is handled automatically via Keycloak client credentials, or set TETRICS_TOKEN.
"""

import json as _json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
from rich import print as rprint

app = typer.Typer(
    name="tetrics",
    help="Tetrics evaluation framework CLI",
    no_args_is_help=True,
)
console = Console()

# ---------------------------------------------------------------------------
# Auth & HTTP helpers
# ---------------------------------------------------------------------------

DEFAULT_SERVER = os.getenv("TETRICS_SERVER", "http://localhost:8000/api/v1")
KEYCLOAK_URL = os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "tetrics")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "fastapi-client")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "fastapi-client-secret-123")

_token_cache: Optional[str] = None
_server_cache: str = DEFAULT_SERVER
_json_mode: bool = False

# Pre-parse global flags before Typer processes subcommands, since
# Typer callbacks don't cascade options to sub-typer commands.
def _pre_parse_globals() -> None:
    global _json_mode, _server_cache, _token_cache
    new_argv = [sys.argv[0]]
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("--json", "-j"):
            _json_mode = True
            i += 1
        elif arg in ("--server", "-s") and i + 1 < len(args):
            _server_cache = args[i + 1].rstrip("/")
            i += 2
        elif arg in ("--token", "-t") and i + 1 < len(args):
            _token_cache = args[i + 1]
            i += 2
        else:
            new_argv.append(arg)
            i += 1
    sys.argv = new_argv

_pre_parse_globals()


def _get_token(token_override: Optional[str] = None) -> str:
    global _token_cache
    if token_override:
        return token_override
    if os.getenv("TETRICS_TOKEN"):
        return os.getenv("TETRICS_TOKEN")
    if _token_cache:
        return _token_cache
    # Auto-fetch via client credentials
    token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": KEYCLOAK_CLIENT_ID,
        "client_secret": KEYCLOAK_CLIENT_SECRET,
        "scope": "openid",
    }
    try:
        resp = httpx.post(token_url, data=data, timeout=10)
        resp.raise_for_status()
        _token_cache = resp.json()["access_token"]
        return _token_cache
    except Exception as e:
        rprint(f"[red]Auth error:[/red] {e}")
        rprint("[yellow]Hint:[/yellow] set TETRICS_TOKEN or ensure Keycloak is reachable")
        raise typer.Exit(1)


def _client(server: str, token: Optional[str] = None) -> httpx.Client:
    return httpx.Client(
        base_url=server,
        headers={"Authorization": f"Bearer {_get_token(token)}"},
        follow_redirects=True,
        timeout=30,
    )


def _print_json(data: Any) -> None:
    """Print data as formatted JSON (handles UUIDs and datetimes)."""
    if hasattr(data, "model_dump"):
        data = data.model_dump(mode="json")
    rprint(Syntax(_json.dumps(data, indent=2, default=str), "json", theme="monokai"))


def _print_table(title: str, columns: List[str], rows: List[List[str]]) -> None:
    table = Table(title=title, header_style="bold cyan")
    for col in columns:
        table.add_column(col)
    for row in rows:
        table.add_row(*[str(c) for c in row])
    console.print(table)


def _print_entity(data: dict, title: str = "Result") -> None:
    """Print a single entity as a key-value panel."""
    lines = [f"[bold cyan]{k}:[/bold cyan] {v}" for k, v in data.items()]
    console.print(Panel("\n".join(lines), title=title))


def _handle_response(resp: httpx.Response) -> Any:
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        rprint(f"[red]Error {resp.status_code}[/red]: {detail}")
        raise typer.Exit(1)
    return resp.json()


def _bool_opt(help_text: str) -> typer.Option:
    """Shorthand for boolean CLI options."""
    return typer.Option(False, help=help_text)


# ---------------------------------------------------------------------------
# Shared callback for global options
# ---------------------------------------------------------------------------

@app.callback()
def main(
    server: str = typer.Option(DEFAULT_SERVER, "--server", "-s", help="API base URL"),
    token: Optional[str] = typer.Option(None, "--token", "-t", help="JWT access token"),
    json_out: bool = typer.Option(False, "--json", "-j", help="Output raw JSON"),
):
    global _server_cache, _token_cache
    _server_cache = server.rstrip("/")
    if json_out:
        _json_mode = True
    if token:
        _token_cache = token


# ---------------------------------------------------------------------------
# Evaluation Programs
# ---------------------------------------------------------------------------

programs = typer.Typer(help="Manage evaluation programs", no_args_is_help=True)
app.add_typer(programs, name="programs")


@programs.command("list")
def programs_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all evaluation programs."""
    resp = _client(_server_cache).get("/domain/evaluation-programs", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["organization_context"], str(d["time_period"]), d["responsible_team"]] for d in data]
    _print_table("Evaluation Programs", ["ID", "Context", "Time Period", "Team"], rows)


@programs.command("get")
def programs_get(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
):
    """Get a single evaluation program."""
    resp = _client(_server_cache).get(f"/domain/evaluation-programs/{program_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Program {program_id}")


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
    resp = _client(_server_cache).post("/domain/evaluation-programs", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Program")


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
    resp = _client(_server_cache).put(f"/domain/evaluation-programs/{program_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Program {program_id}")


@programs.command("delete")
def programs_delete(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an evaluation program. Admin only."""
    if not force:
        typer.confirm(f"Delete evaluation program {program_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/evaluation-programs/{program_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] evaluation program {program_id}")


@programs.command("goals")
def programs_goals(
    program_id: str = typer.Argument(..., help="Evaluation program UUID"),
):
    """List goals belonging to an evaluation program."""
    resp = _client(_server_cache).get(f"/domain/evaluation-programs/{program_id}/goals")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["purpose"], d["focus"], d["viewpoint"]] for d in data]
    _print_table(f"Goals for Program {program_id}", ["ID", "Purpose", "Focus", "Viewpoint"], rows)


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

goals = typer.Typer(help="Manage goals", no_args_is_help=True)
app.add_typer(goals, name="goals")


@goals.command("list")
def goals_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all goals."""
    resp = _client(_server_cache).get("/domain/goals", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["purpose"], d["focus"], d["viewpoint"], d.get("evaluation_program_id", "")] for d in data]
    _print_table("Goals", ["ID", "Purpose", "Focus", "Viewpoint", "Program ID"], rows)


@goals.command("get")
def goals_get(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
):
    """Get a single goal."""
    resp = _client(_server_cache).get(f"/domain/goals/{goal_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Goal {goal_id}")


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
    resp = _client(_server_cache).post("/domain/goals", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Goal")


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
    resp = _client(_server_cache).put(f"/domain/goals/{goal_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Goal {goal_id}")


@goals.command("delete")
def goals_delete(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a goal. Admin only."""
    if not force:
        typer.confirm(f"Delete goal {goal_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/goals/{goal_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] goal {goal_id}")


@goals.command("criteria")
def goals_criteria(
    goal_id: str = typer.Argument(..., help="Goal UUID"),
):
    """List evaluation criteria belonging to a goal."""
    resp = _client(_server_cache).get(f"/domain/goals/{goal_id}/evaluation-criteria")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["dimension"], str(d.get("weight", 1.0)), d.get("aggregation_strategy", "")] for d in data]
    _print_table(f"Criteria for Goal {goal_id}", ["ID", "Dimension", "Weight", "Aggregation"], rows)


# ---------------------------------------------------------------------------
# Evaluation Criteria
# ---------------------------------------------------------------------------

criteria = typer.Typer(help="Manage evaluation criteria", no_args_is_help=True)
app.add_typer(criteria, name="criteria")


@criteria.command("list")
def criteria_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all evaluation criteria."""
    resp = _client(_server_cache).get("/domain/evaluation-criteria", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["dimension"], d.get("goal_id", ""), str(d.get("weight", 1.0)), d.get("aggregation_strategy", "")] for d in data]
    _print_table("Evaluation Criteria", ["ID", "Dimension", "Goal ID", "Weight", "Aggregation"], rows)


@criteria.command("get")
def criteria_get(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """Get a single evaluation criterion."""
    resp = _client(_server_cache).get(f"/domain/evaluation-criteria/{criterion_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Criterion {criterion_id}")


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
    resp = _client(_server_cache).post("/domain/evaluation-criteria", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Criterion")


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
    resp = _client(_server_cache).put(f"/domain/evaluation-criteria/{criterion_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Criterion {criterion_id}")


@criteria.command("delete")
def criteria_delete(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an evaluation criterion. Admin only."""
    if not force:
        typer.confirm(f"Delete evaluation criterion {criterion_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/evaluation-criteria/{criterion_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] evaluation criterion {criterion_id}")


@criteria.command("metrics")
def criteria_metrics(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """List metrics belonging to a criterion."""
    resp = _client(_server_cache).get(f"/domain/evaluation-criteria/{criterion_id}/metrics")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["name"], d["unit"], str(d.get("weight", 1.0)), d.get("direction", "")] for d in data]
    _print_table(f"Metrics for Criterion {criterion_id}", ["ID", "Name", "Unit", "Weight", "Direction"], rows)


@criteria.command("scores")
def criteria_scores(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """List aggregated scores for a criterion."""
    resp = _client(_server_cache).get(f"/domain/evaluation-criteria/{criterion_id}/aggregated-scores")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], str(d["score"]), d.get("tool_config_id", ""), str(d.get("timestamp", ""))] for d in data]
    _print_table(f"Scores for Criterion {criterion_id}", ["ID", "Score", "Tool Config ID", "Timestamp"], rows)


@criteria.command("recalculate")
def criteria_recalculate(
    criterion_id: str = typer.Argument(..., help="Criterion UUID"),
):
    """Recalculate all aggregated scores for a criterion. Admin only."""
    resp = _client(_server_cache).post(f"/domain/evaluation-criteria/{criterion_id}/recalculate-scores")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rprint(f"[green]Recalculated[/green] {len(data)} scores for criterion {criterion_id}")
    rows = [[d["id"], str(d["score"]), d.get("tool_config_id", "")] for d in data]
    _print_table("Recalculated Scores", ["ID", "Score", "Tool Config ID"], rows)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

metrics = typer.Typer(help="Manage metrics", no_args_is_help=True)
app.add_typer(metrics, name="metrics")


_METRIC_UNITS = ["Percent", "Cardinal"]
_SCALE_TYPES = ["nominal", "ordinal", "interval", "ratio"]
_COLLECTION_METHODS = ["automated", "manual", "hybrid"]
_NORMALIZATION_METHODS = ["none", "max", "min"]
_DIRECTIONS = ["higher_is_better", "lower_is_better", "target_value"]


@metrics.command("list")
def metrics_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all metrics."""
    resp = _client(_server_cache).get("/domain/metrics", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["name"], d["unit"], str(d.get("weight", 1.0)), d.get("direction", "")] for d in data]
    _print_table("Metrics", ["ID", "Name", "Unit", "Weight", "Direction"], rows)


@metrics.command("get")
def metrics_get(
    metric_id: str = typer.Argument(..., help="Metric UUID"),
):
    """Get a single metric."""
    resp = _client(_server_cache).get(f"/domain/metrics/{metric_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Metric {metric_id}")


@metrics.command("create")
def metrics_create(
    name: str = typer.Option(..., "--name", help="Metric name"),
    definition: str = typer.Option(..., "--definition", help="Formal definition of how this is measured"),
    unit: str = typer.Option(..., "--unit", help=f"One of: {_METRIC_UNITS}"),
    scale_type: str = typer.Option(..., "--scale-type", help=f"One of: {_SCALE_TYPES}"),
    collection_method: str = typer.Option(..., "--collection-method", help=f"One of: {_COLLECTION_METHODS}"),
    direction: str = typer.Option(..., "--direction", help=f"One of: {_DIRECTIONS}"),
    evaluation_criterion_id: str = typer.Option(..., "--evaluation-criterion-id", help="Parent criterion UUID"),
    weight: float = typer.Option(1.0, "--weight", help="Metric weight (can be negative for penalties)"),
    target_value: Optional[float] = typer.Option(None, "--target-value", help="Target value if applicable"),
    normalization_method: str = typer.Option("none", "--normalization-method", help=f"One of: {_NORMALIZATION_METHODS}"),
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
    resp = _client(_server_cache).post("/domain/metrics", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Metric")


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
    resp = _client(_server_cache).put(f"/domain/metrics/{metric_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Metric {metric_id}")


@metrics.command("delete")
def metrics_delete(
    metric_id: str = typer.Argument(..., help="Metric UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a metric. Admin only."""
    if not force:
        typer.confirm(f"Delete metric {metric_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/metrics/{metric_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] metric {metric_id}")


# ---------------------------------------------------------------------------
# LLM Tool Configurations
# ---------------------------------------------------------------------------

tools = typer.Typer(help="Manage LLM tool configurations", no_args_is_help=True)
app.add_typer(tools, name="tools")


@tools.command("list")
def tools_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all LLM tool configurations."""
    resp = _client(_server_cache).get("/domain/llm-tool-configurations", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], d["tool_name"], d["model_version"], str(d.get("total_score", "N/A")), str(d.get("timestamp", ""))] for d in data]
    _print_table("LLM Tool Configurations", ["ID", "Tool", "Model", "Total Score", "Timestamp"], rows)


@tools.command("get")
def tools_get(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
):
    """Get a single LLM tool configuration."""
    resp = _client(_server_cache).get(f"/domain/llm-tool-configurations/{config_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Tool Config {config_id}")


@tools.command("create")
def tools_create(
    tool_name: str = typer.Option(..., "--tool-name", help="Name of the LLM tool"),
    model_version: str = typer.Option(..., "--model-version", help="Model version string"),
    prompt_strategy: str = typer.Option(..., "--prompt-strategy", help="Prompt strategy description"),
    parameters: str = typer.Option("{}", "--parameters", help="JSON object of configuration parameters"),
    timestamp: Optional[str] = typer.Option(None, "--timestamp", help="ISO datetime (defaults to now)"),
    toolchain: Optional[str] = typer.Option(None, "--toolchain", help="Tools/technologies used"),
    ide: Optional[str] = typer.Option(None, "--ide", help="IDE used"),
    ide_plugins: Optional[str] = typer.Option(None, "--ide-plugins", help="JSON list of IDE plugins"),
    conversation_history: Optional[str] = typer.Option(None, "--conversation-history", help="JSON list of role/content pairs"),
    skills_used: Optional[str] = typer.Option(None, "--skills-used", help="JSON list of skills/techniques"),
):
    """Create a new LLM tool configuration. Admin only."""
    body: Dict[str, Any] = {
        "tool_name": tool_name,
        "model_version": model_version,
        "prompt_strategy": prompt_strategy,
        "parameters": _json.loads(parameters),
    }
    if timestamp is not None:
        body["timestamp"] = timestamp
    if toolchain is not None:
        body["toolchain"] = toolchain
    if ide is not None:
        body["ide"] = ide
    if ide_plugins is not None:
        body["ide_plugins"] = _json.loads(ide_plugins)
    if conversation_history is not None:
        body["conversation_history"] = _json.loads(conversation_history)
    if skills_used is not None:
        body["skills_used"] = _json.loads(skills_used)
    resp = _client(_server_cache).post("/domain/llm-tool-configurations", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Tool Config")


@tools.command("update")
def tools_update(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
    tool_name: Optional[str] = typer.Option(None, "--tool-name"),
    model_version: Optional[str] = typer.Option(None, "--model-version"),
    prompt_strategy: Optional[str] = typer.Option(None, "--prompt-strategy"),
    parameters: Optional[str] = typer.Option(None, "--parameters", help="JSON object"),
    timestamp: Optional[str] = typer.Option(None, "--timestamp", help="ISO datetime"),
    toolchain: Optional[str] = typer.Option(None, "--toolchain"),
    ide: Optional[str] = typer.Option(None, "--ide"),
    ide_plugins: Optional[str] = typer.Option(None, "--ide-plugins", help="JSON list"),
    conversation_history: Optional[str] = typer.Option(None, "--conversation-history", help="JSON list"),
    skills_used: Optional[str] = typer.Option(None, "--skills-used", help="JSON list"),
):
    """Update an LLM tool configuration. Admin only."""
    body: Dict[str, Any] = {}
    if tool_name is not None:
        body["tool_name"] = tool_name
    if model_version is not None:
        body["model_version"] = model_version
    if prompt_strategy is not None:
        body["prompt_strategy"] = prompt_strategy
    if parameters is not None:
        body["parameters"] = _json.loads(parameters)
    if timestamp is not None:
        body["timestamp"] = timestamp
    if toolchain is not None:
        body["toolchain"] = toolchain
    if ide is not None:
        body["ide"] = ide
    if ide_plugins is not None:
        body["ide_plugins"] = _json.loads(ide_plugins)
    if conversation_history is not None:
        body["conversation_history"] = _json.loads(conversation_history)
    if skills_used is not None:
        body["skills_used"] = _json.loads(skills_used)
    resp = _client(_server_cache).put(f"/domain/llm-tool-configurations/{config_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Tool Config {config_id}")


@tools.command("delete")
def tools_delete(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an LLM tool configuration. Admin only."""
    if not force:
        typer.confirm(f"Delete tool config {config_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/llm-tool-configurations/{config_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] tool config {config_id}")


@tools.command("measurements")
def tools_measurements(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
):
    """List measurements for a tool configuration."""
    resp = _client(_server_cache).get(f"/domain/llm-tool-configurations/{config_id}/measurements")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], str(d["value"]), d.get("metric_id", ""), d.get("evaluator", ""), str(d.get("date", ""))] for d in data]
    _print_table(f"Measurements for Config {config_id}", ["ID", "Value", "Metric ID", "Evaluator", "Date"], rows)


@tools.command("scores")
def tools_scores(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
):
    """List aggregated scores for a tool configuration."""
    resp = _client(_server_cache).get(f"/domain/llm-tool-configurations/{config_id}/aggregated-scores")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], str(d["score"]), d.get("criterion_id", ""), str(d.get("timestamp", ""))] for d in data]
    _print_table(f"Scores for Config {config_id}", ["ID", "Score", "Criterion ID", "Timestamp"], rows)


# ---------------------------------------------------------------------------
# Measurements
# ---------------------------------------------------------------------------

measurements = typer.Typer(help="Manage measurements", no_args_is_help=True)
app.add_typer(measurements, name="measurements")


@measurements.command("list")
def measurements_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all measurements."""
    resp = _client(_server_cache).get("/domain/measurements", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], str(d["value"]), d.get("metric_id", ""), d.get("llm_tool_configuration_id", ""), d.get("evaluator", ""), str(d.get("date", ""))] for d in data]
    _print_table("Measurements", ["ID", "Value", "Metric ID", "Tool Config ID", "Evaluator", "Date"], rows)


@measurements.command("get")
def measurements_get(
    measurement_id: str = typer.Argument(..., help="Measurement UUID"),
):
    """Get a single measurement."""
    resp = _client(_server_cache).get(f"/domain/measurements/{measurement_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Measurement {measurement_id}")


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
    resp = _client(_server_cache).post("/domain/measurements", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Measurement")


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
    resp = _client(_server_cache).put(f"/domain/measurements/{measurement_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Measurement {measurement_id}")


@measurements.command("delete")
def measurements_delete(
    measurement_id: str = typer.Argument(..., help="Measurement UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a measurement. Admin only."""
    if not force:
        typer.confirm(f"Delete measurement {measurement_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/measurements/{measurement_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] measurement {measurement_id}")


# ---------------------------------------------------------------------------
# Aggregated Scores
# ---------------------------------------------------------------------------

scores = typer.Typer(help="Manage aggregated scores", no_args_is_help=True)
app.add_typer(scores, name="scores")


@scores.command("list")
def scores_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all aggregated scores."""
    resp = _client(_server_cache).get("/domain/aggregated-scores", params={"skip": skip, "limit": limit})
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    rows = [[d["id"], str(d["score"]), d.get("criterion_id", ""), d.get("tool_config_id", ""), str(d.get("timestamp", ""))] for d in data]
    _print_table("Aggregated Scores", ["ID", "Score", "Criterion ID", "Tool Config ID", "Timestamp"], rows)


@scores.command("get")
def scores_get(
    score_id: str = typer.Argument(..., help="Score UUID"),
):
    """Get a single aggregated score."""
    resp = _client(_server_cache).get(f"/domain/aggregated-scores/{score_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Score {score_id}")


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
    resp = _client(_server_cache).post("/domain/aggregated-scores", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Created Aggregated Score")


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
    resp = _client(_server_cache).put(f"/domain/aggregated-scores/{score_id}", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Score {score_id}")


@scores.command("delete")
def scores_delete(
    score_id: str = typer.Argument(..., help="Score UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an aggregated score. Admin only."""
    if not force:
        typer.confirm(f"Delete aggregated score {score_id}?", abort=True)
    resp = _client(_server_cache).delete(f"/domain/aggregated-scores/{score_id}")
    _handle_response(resp)
    rprint(f"[green]Deleted[/green] aggregated score {score_id}")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

users = typer.Typer(help="Manage users", no_args_is_help=True)
app.add_typer(users, name="users")


@users.command("get")
def users_get(
    user_id: str = typer.Argument(..., help="User UUID"),
):
    """Get a user by ID."""
    resp = _client(_server_cache).get(f"/users/{user_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"User {user_id}")


@users.command("get-by-email")
def users_get_by_email(
    email: str = typer.Argument(..., help="User email"),
):
    """Get a user by email address."""
    resp = _client(_server_cache).get(f"/users/email/{email}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"User {email}")


@users.command("get-by-external-id")
def users_get_by_external_id(
    external_id: str = typer.Argument(..., help="External identity provider ID"),
):
    """Get a user by external identity provider ID."""
    resp = _client(_server_cache).get(f"/users/external/{external_id}")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"User {external_id}")


@users.command("sync")
def users_sync(
    external_id: str = typer.Option(..., "--external-id", help="External identity provider ID"),
    email: str = typer.Option(..., "--email", help="User email"),
    full_name: Optional[str] = typer.Option(None, "--full-name", help="Full name"),
):
    """Sync a user from the identity provider (creates or updates)."""
    params: Dict[str, Any] = {"external_id": external_id, "email": email}
    if full_name is not None:
        params["full_name"] = full_name
    resp = _client(_server_cache).post("/users/sync", params=params)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, "Synced User")


@users.command("update-preferences")
def users_update_preferences(
    user_id: str = typer.Argument(..., help="User UUID"),
    bio: Optional[str] = typer.Option(None, "--bio", help="User biography"),
    notification_preferences: Optional[str] = typer.Option(None, "--notification-preferences", help="JSON string of preferences"),
    theme_preference: Optional[str] = typer.Option(None, "--theme-preference", help="light, dark, or system"),
):
    """Update user preferences."""
    body: Dict[str, Any] = {}
    if bio is not None:
        body["bio"] = bio
    if notification_preferences is not None:
        body["notification_preferences"] = notification_preferences
    if theme_preference is not None:
        body["theme_preference"] = theme_preference
    resp = _client(_server_cache).put(f"/users/{user_id}/preferences", json=body)
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Updated Preferences for {user_id}")


@users.command("deactivate")
def users_deactivate(
    user_id: str = typer.Argument(..., help="User UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Deactivate a user. Admin only."""
    if not force:
        typer.confirm(f"Deactivate user {user_id}?", abort=True)
    resp = _client(_server_cache).patch(f"/users/{user_id}/deactivate")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Deactivated User {user_id}")


@users.command("reactivate")
def users_reactivate(
    user_id: str = typer.Argument(..., help="User UUID"),
):
    """Reactivate a user. Admin only."""
    resp = _client(_server_cache).patch(f"/users/{user_id}/reactivate")
    data = _handle_response(resp)
    if _json_mode:
        return _print_json(data)
    _print_entity(data, f"Reactivated User {user_id}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app()
