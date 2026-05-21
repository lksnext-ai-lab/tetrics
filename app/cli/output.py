"""Output formatting — JSON, tables, panels, and data filtering."""

import json as _json
from typing import Any, Dict, List

from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table

from app.cli.constants import RELATION_KEYS, SUMMARY_FIELDS

console = Console()


def print_json(data: Any) -> None:
    """Print data as formatted JSON (handles UUIDs and datetimes)."""
    if hasattr(data, "model_dump"):
        data = data.model_dump(mode="json")
    console.print(Syntax(_json.dumps(data, indent=2, default=str), "json", theme="monokai"))


def print_table(title: str, columns: List[str], rows: List[List[str]]) -> None:
    """Print a Rich table with the given title and columns."""
    table = Table(title=title, header_style="bold cyan")
    for col in columns:
        table.add_column(col)
    for row in rows:
        table.add_row(*[str(c) for c in row])
    console.print(table)


def print_entity(data: dict, title: str = "Result") -> None:
    """Print a single entity as a key-value panel."""
    lines = [f"[bold cyan]{k}:[/bold cyan] {v}" for k, v in data.items()]
    console.print(Panel("\n".join(lines), title=title))


def strip_relations(data: Any) -> Any:
    """Remove nested relation keys so every response is flat and focused."""
    if isinstance(data, list):
        return [strip_relations(item) for item in data]
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k not in RELATION_KEYS}
    return data


def summarize(data: Any, entity_type: str) -> Any:
    """Reduce a list of dicts (or a single dict) to only the keys in SUMMARY_FIELDS."""
    keys = SUMMARY_FIELDS.get(entity_type, [])
    if not keys:
        return data
    if isinstance(data, list):
        return [{k: item[k] for k in keys if k in item} for item in data]
    if isinstance(data, dict):
        return {k: data[k] for k in keys if k in data}
    return data
