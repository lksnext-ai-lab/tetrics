"""CLI commands for LLM tool configurations."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, print_table, summarize

tools = typer.Typer(help="Manage LLM tool configurations", no_args_is_help=True)


@tools.command("list")
def tools_list(
    skip: int = typer.Option(0, "--skip"),
    limit: int = typer.Option(100, "--limit"),
):
    """List all LLM tool configurations."""
    resp = get_client(get_server()).get("/domain/llm-tool-configurations", params={"skip": skip, "limit": limit})
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "llm_tool_configuration")
        return print_json(data)
    rows = [[d["id"], d["tool_name"], d["model_version"], str(d.get("total_score", "N/A")), str(d.get("timestamp", ""))] for d in data]
    print_table("LLM Tool Configurations", ["ID", "Tool", "Model", "Total Score", "Timestamp"], rows)


@tools.command("get")
def tools_get(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
):
    """Get a single LLM tool configuration."""
    resp = get_client(get_server()).get(f"/domain/llm-tool-configurations/{config_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "llm_tool_configuration")
        return print_json(data)
    print_entity(data, f"Tool Config {config_id}")


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
    resp = get_client(get_server()).post("/domain/llm-tool-configurations", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Created Tool Config")


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
    resp = get_client(get_server()).put(f"/domain/llm-tool-configurations/{config_id}", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Tool Config {config_id}")


@tools.command("delete")
def tools_delete(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete an LLM tool configuration. Admin only."""
    if not force:
        typer.confirm(f"Delete tool config {config_id}?", abort=True)
    resp = get_client(get_server()).delete(f"/domain/llm-tool-configurations/{config_id}")
    handle_response(resp)
    typer.echo(f"Deleted tool config {config_id}")


@tools.command("measurements")
def tools_measurements(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
):
    """List measurements for a tool configuration."""
    resp = get_client(get_server()).get(f"/domain/llm-tool-configurations/{config_id}/measurements")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "measurement")
        return print_json(data)
    rows = [[d["id"], str(d["value"]), d.get("metric_id", ""), d.get("evaluator", ""), str(d.get("date", ""))] for d in data]
    print_table(f"Measurements for Config {config_id}", ["ID", "Value", "Metric ID", "Evaluator", "Date"], rows)


@tools.command("scores")
def tools_scores(
    config_id: str = typer.Argument(..., help="Tool config UUID"),
):
    """List aggregated scores for a tool configuration."""
    resp = get_client(get_server()).get(f"/domain/llm-tool-configurations/{config_id}/aggregated-scores")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "aggregated_score")
        return print_json(data)
    rows = [[d["id"], str(d["score"]), d.get("criterion_id", ""), str(d.get("timestamp", ""))] for d in data]
    print_table(f"Scores for Config {config_id}", ["ID", "Score", "Criterion ID", "Timestamp"], rows)
