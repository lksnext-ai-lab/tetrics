"""Tetrics CLI — main app assembly, global state, and pre-parse workaround.

The ``_pre_parse_globals()`` call at module level strips ``--json``, ``--verbose``,
``--server``, and ``--token`` from ``sys.argv`` before Typer processes them.
This is necessary because Typer callbacks do not cascade options to sub-typer
commands.  The parsed values are stored in ``app.cli.state`` and exposed
via accessor functions that command modules import.
"""

import sys
from typing import Optional

import typer

from app.cli.auth import set_token
from app.cli.state import (
    DEFAULT_SERVER,
    is_json_mode,
    is_verbose,
    set_json_mode,
    set_server,
    set_verbose,
)

# ---- pre-parse globals from raw argv ---------------------------------------


def _pre_parse_globals() -> None:
    """Strip global flags from sys.argv before Typer sees them."""
    new_argv = [sys.argv[0]]
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("--json", "-j"):
            set_json_mode(True)
            i += 1
        elif arg in ("--verbose", "-v"):
            set_verbose(True)
            i += 1
        elif arg in ("--server", "-s") and i + 1 < len(args):
            set_server(args[i + 1])
            i += 2
        elif arg in ("--token", "-t") and i + 1 < len(args):
            set_token(args[i + 1])
            i += 2
        else:
            new_argv.append(arg)
            i += 1
    sys.argv = new_argv


_pre_parse_globals()


# ---- Typer app -------------------------------------------------------------

app = typer.Typer(
    name="tetrics",
    help="Tetrics evaluation framework CLI",
    no_args_is_help=True,
)


@app.callback()
def main(
    server: str = typer.Option(DEFAULT_SERVER, "--server", "-s", help="API base URL"),
    token: Optional[str] = typer.Option(None, "--token", "-t", help="JWT access token"),
    json_out: bool = typer.Option(False, "--json", "-j", help="Output raw JSON"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show all fields in list output (JSON only)"),
):
    set_server(server)
    if json_out:
        set_json_mode(True)
    if token:
        set_token(token)
    if verbose:
        set_verbose(True)


# ---- register command groups -----------------------------------------------

from app.cli.commands.criteria import criteria  # noqa: E402
from app.cli.commands.goals import goals  # noqa: E402
from app.cli.commands.measurements import measurements  # noqa: E402
from app.cli.commands.metrics import metrics  # noqa: E402
from app.cli.commands.programs import programs  # noqa: E402
from app.cli.commands.scores import scores  # noqa: E402
from app.cli.commands.tools import tools  # noqa: E402
from app.cli.commands.users import users  # noqa: E402

app.add_typer(programs, name="programs")
app.add_typer(goals, name="goals")
app.add_typer(criteria, name="criteria")
app.add_typer(metrics, name="metrics")
app.add_typer(tools, name="tools")
app.add_typer(measurements, name="measurements")
app.add_typer(scores, name="scores")
app.add_typer(users, name="users")


# ---- entry point -----------------------------------------------------------

if __name__ == "__main__":
    app()
