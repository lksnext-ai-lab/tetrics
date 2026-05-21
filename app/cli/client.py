"""HTTP client factory and response handling."""

from typing import Any, Optional

import httpx
import typer
from rich import print as rprint

from app.cli.auth import get_token


def get_client(server: str, token: Optional[str] = None) -> httpx.Client:
    """Create an httpx.Client pre-configured with auth and base URL."""
    return httpx.Client(
        base_url=server,
        headers={"Authorization": f"Bearer {get_token(token)}"},
        follow_redirects=True,
        timeout=30,
    )


def handle_response(resp: httpx.Response) -> Any:
    """Check for errors and return parsed JSON, or exit."""
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        rprint(f"[red]Error {resp.status_code}[/red]: {detail}")
        raise typer.Exit(1)
    from app.cli.output import strip_relations
    return strip_relations(resp.json())
