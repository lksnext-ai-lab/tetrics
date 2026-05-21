"""Auth helpers — Keycloak password grant and token caching."""

import os
from typing import Optional

import httpx
import typer
from rich import print as rprint

# Keycloak defaults
KEYCLOAK_URL = os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "tetrics")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "fastapi-client")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "fastapi-client-secret-123")
CLI_ADMIN_USER = os.getenv("TETRICS_ADMIN_USER", "admin")
CLI_ADMIN_PASSWORD = os.getenv("TETRICS_ADMIN_PASSWORD", "admin123")

_token_cache: Optional[str] = None


def get_token(token_override: Optional[str] = None) -> str:
    """Return a JWT access token, fetching one via password grant if needed."""
    global _token_cache
    if token_override:
        return token_override
    if os.getenv("TETRICS_TOKEN"):
        return os.getenv("TETRICS_TOKEN")  # type: ignore[return-value]
    if _token_cache:
        return _token_cache

    token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
    data = {
        "grant_type": "password",
        "client_id": KEYCLOAK_CLIENT_ID,
        "client_secret": KEYCLOAK_CLIENT_SECRET,
        "username": CLI_ADMIN_USER,
        "password": CLI_ADMIN_PASSWORD,
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


def set_token(token: str) -> None:
    """Explicitly set the cached token (used by --token flag)."""
    global _token_cache
    _token_cache = token
