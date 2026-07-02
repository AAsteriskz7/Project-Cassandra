from typing import Any
from cassandra.mcp.schemas import MCPToolCall


def parse_mcp_tool_calls(data: dict[str, Any] | list[dict[str, Any]]) -> list[MCPToolCall]:
    """
    Parse MCP JSON-RPC messages to extract tool calls.
    Supports both single requests and batch arrays.
    
    Standard MCP tools/call format:
    {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "file_read",
            "arguments": {"path": "/etc/passwd"}
        }
    }
    """
    if isinstance(data, dict):
        items = [data]
    else:
        items = data

    tool_calls: list[MCPToolCall] = []
    for item in items:
        method = item.get("method", "")
        if method == "tools/call":
            params = item.get("params", {})
            tool_calls.append(MCPToolCall(
                method=method,
                call_id=item.get("id"),
                tool_name=params.get("name", "unknown"),
                arguments=params.get("arguments", {}),
                raw_params=params
            ))
    return tool_calls


def extract_tool_calls_from_completion(response_data: dict[str, Any]) -> list[MCPToolCall]:
    """
    Extract tool calls from an OpenAI-compatible chat completion response.
    These are the tool calls the target LLM wants to execute.
    Maps them into MCPToolCall format for the Gatekeeper.
    """
    tool_calls: list[MCPToolCall] = []
    choices = response_data.get("choices", [])
    for choice in choices:
        msg = choice.get("message", {})
        for tc in msg.get("tool_calls", []):
            func = tc.get("function", {})
            import json
            try:
                args = json.loads(func.get("arguments", "{}"))
            except (json.JSONDecodeError, TypeError):
                args = {}
            tool_calls.append(MCPToolCall(
                method="tools/call",
                call_id=tc.get("id"),
                tool_name=func.get("name", "unknown"),
                arguments=args,
                raw_params=func
            ))
    return tool_calls
