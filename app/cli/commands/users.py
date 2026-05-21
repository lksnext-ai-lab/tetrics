"""CLI commands for users."""

import json as _json
from typing import Any, Dict, Optional

import typer

from app.cli.client import get_client, handle_response
from app.cli.state import get_server, is_json_mode, is_verbose
from app.cli.output import print_entity, print_json, summarize

users = typer.Typer(help="Manage users", no_args_is_help=True)


@users.command("get")
def users_get(
    user_id: str = typer.Argument(..., help="User UUID"),
):
    """Get a user by ID."""
    resp = get_client(get_server()).get(f"/users/{user_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "user")
        return print_json(data)
    print_entity(data, f"User {user_id}")


@users.command("get-by-email")
def users_get_by_email(
    email: str = typer.Argument(..., help="User email"),
):
    """Get a user by email address."""
    resp = get_client(get_server()).get(f"/users/email/{email}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "user")
        return print_json(data)
    print_entity(data, f"User {email}")


@users.command("get-by-external-id")
def users_get_by_external_id(
    external_id: str = typer.Argument(..., help="External identity provider ID"),
):
    """Get a user by external identity provider ID."""
    resp = get_client(get_server()).get(f"/users/external/{external_id}")
    data = handle_response(resp)
    if is_json_mode():
        if not is_verbose():
            data = summarize(data, "user")
        return print_json(data)
    print_entity(data, f"User {external_id}")


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
    resp = get_client(get_server()).post("/users/sync", params=params)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, "Synced User")


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
    resp = get_client(get_server()).put(f"/users/{user_id}/preferences", json=body)
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Updated Preferences for {user_id}")


@users.command("deactivate")
def users_deactivate(
    user_id: str = typer.Argument(..., help="User UUID"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Deactivate a user. Admin only."""
    if not force:
        typer.confirm(f"Deactivate user {user_id}?", abort=True)
    resp = get_client(get_server()).patch(f"/users/{user_id}/deactivate")
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Deactivated User {user_id}")


@users.command("reactivate")
def users_reactivate(
    user_id: str = typer.Argument(..., help="User UUID"),
):
    """Reactivate a user. Admin only."""
    resp = get_client(get_server()).patch(f"/users/{user_id}/reactivate")
    data = handle_response(resp)
    if is_json_mode():
        return print_json(data)
    print_entity(data, f"Reactivated User {user_id}")
