"""Shared mutable state for the CLI — server URL, output mode flags.

Extracted into its own module so that both ``main.py`` and the command
modules can import these values without circular dependencies (``main.py``
imports the commands, and the commands need to read the current server /
json-mode / verbose flags).
"""

import os

DEFAULT_SERVER = os.getenv("TETRICS_SERVER", "http://localhost:8000/api/v1")

_server_cache: str = DEFAULT_SERVER
_json_mode: bool = False
_verbose: bool = False


def get_server() -> str:
    return _server_cache


def set_server(server: str) -> None:
    global _server_cache
    _server_cache = server.rstrip("/")


def is_json_mode() -> bool:
    return _json_mode


def set_json_mode(value: bool) -> None:
    global _json_mode
    _json_mode = value


def is_verbose() -> bool:
    return _verbose


def set_verbose(value: bool) -> None:
    global _verbose
    _verbose = value
