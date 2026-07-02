from pydantic import BaseModel, Field
from typing import Any


class MCPToolCall(BaseModel):
    """Represents a parsed MCP tools/call request."""
    method: str = "tools/call"
    call_id: str | int | None = None
    tool_name: str = ""
    arguments: dict[str, Any] = {}
    raw_params: dict[str, Any] = {}


class MCPErrorResponse(BaseModel):
    """A JSON-RPC 2.0 error response for halted MCP calls."""
    jsonrpc: str = "2.0"
    id: str | int | None = None
    error: dict[str, Any] = {}

    @classmethod
    def halted(cls, call_id: str | int | None, reason: str) -> "MCPErrorResponse":
        return cls(
            id=call_id,
            error={
                "code": -32001,
                "message": "Execution halted by Cassandra",
                "data": {"reason": reason}
            }
        )


class MCPSuccessResponse(BaseModel):
    """A JSON-RPC 2.0 success response for allowed MCP calls."""
    jsonrpc: str = "2.0"
    id: str | int | None = None
    result: dict[str, Any] = {}


# Risk classification for common MCP tool patterns
TOOL_RISK_MAP: dict[str, str] = {
    # HIGH risk — write/exec operations
    "file_write": "HIGH",
    "file_delete": "HIGH",
    "execute_command": "HIGH",
    "run_command": "HIGH",
    "shell_exec": "HIGH",
    "database_write": "HIGH",
    "database_delete": "HIGH",
    "send_email": "HIGH",
    # MEDIUM risk — read operations
    "file_read": "MEDIUM",
    "read_file": "MEDIUM",
    "database_query": "MEDIUM",
    "database_read": "MEDIUM",
    "list_directory": "MEDIUM",
    "list_dir": "MEDIUM",
    # LOW risk — informational
    "web_search": "LOW",
    "search_web": "LOW",
    "get_time": "LOW",
    "get_weather": "LOW",
}


def classify_tool_risk(tool_name: str) -> str:
    """Classify the risk level of a tool based on its name."""
    name_lower = tool_name.lower()
    # Direct match
    if name_lower in TOOL_RISK_MAP:
        return TOOL_RISK_MAP[name_lower]
    # Keyword heuristic fallback
    if any(kw in name_lower for kw in ("write", "delete", "exec", "run", "send", "drop", "remove")):
        return "HIGH"
    if any(kw in name_lower for kw in ("read", "get", "list", "query", "fetch")):
        return "MEDIUM"
    return "MEDIUM"  # Default to MEDIUM if unknown
