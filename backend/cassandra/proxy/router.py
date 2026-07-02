from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any
import uuid
import time

from cassandra.mcp.interceptor import MCPInterceptor
from cassandra.mcp.schemas import MCPToolCall, classify_tool_risk


router = APIRouter()

# Singleton interceptor — initialized on first request
_interceptor: MCPInterceptor | None = None

def get_interceptor() -> MCPInterceptor:
    global _interceptor
    if _interceptor is None:
        _interceptor = MCPInterceptor()
    return _interceptor


class ChatCompletionRequest(BaseModel):
    messages: list[dict[str, Any]]
    model: str | None = None
    tools: list[dict[str, Any]] | None = None
    stream: bool = False
    # Cassandra-specific fields for direct interception testing
    cassandra_cot: str | None = None
    cassandra_system_prompt: str | None = None
    cassandra_tool_calls: list[dict[str, Any]] | None = None


@router.post("/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    """
    Cassandra interceptor proxy endpoint.
    
    When cassandra_cot and cassandra_tool_calls are provided,
    the request goes directly through the swarm pipeline
    without needing to call the target LLM.
    
    In production, this would first forward to the target LLM,
    capture the CoT from its response, then run the pipeline.
    """
    session_id = str(uuid.uuid4())
    start_time = time.time()
    interceptor = get_interceptor()

    # Extract system prompt from messages
    system_prompt = req.cassandra_system_prompt or ""
    if not system_prompt:
        for msg in req.messages:
            if msg.get("role") == "system":
                system_prompt = msg.get("content", "")
                break

    # Extract user query from messages
    user_query = ""
    for msg in reversed(req.messages):
        if msg.get("role") == "user":
            user_query = msg.get("content", "")
            break

    # Get CoT — either directly provided or from last assistant message
    cot_text = req.cassandra_cot or ""
    if not cot_text:
        for msg in reversed(req.messages):
            if msg.get("role") == "assistant":
                cot_text = msg.get("content", "")
                break

    if not cot_text:
        return {
            "id": f"chatcmpl-{session_id}",
            "object": "chat.completion",
            "session_id": session_id,
            "cassandra": {"status": "skipped", "reason": "No CoT provided for analysis"},
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "No CoT to analyze."},
                "finish_reason": "stop"
            }]
        }

    # Parse tool calls
    tool_calls: list[MCPToolCall] = []
    if req.cassandra_tool_calls:
        for tc in req.cassandra_tool_calls:
            tool_calls.append(MCPToolCall(
                method="tools/call",
                call_id=tc.get("id", str(uuid.uuid4())),
                tool_name=tc.get("name", tc.get("function", {}).get("name", "unknown")),
                arguments=tc.get("arguments", tc.get("function", {}).get("arguments", {})),
                raw_params=tc
            ))

    # Run the full interception pipeline
    try:
        decision, mcp_responses = await interceptor.intercept(
            session_id=session_id,
            system_prompt=system_prompt,
            user_query=user_query,
            cot_text=cot_text,
            tool_calls=tool_calls
        )
    except Exception as e:
        return {
            "id": f"chatcmpl-{session_id}",
            "object": "chat.completion",
            "session_id": session_id,
            "cassandra": {"status": "error", "reason": str(e)},
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": f"Cassandra interception error: {e}"},
                "finish_reason": "stop"
            }]
        }

    elapsed = round(time.time() - start_time, 3)

    return {
        "id": f"chatcmpl-{session_id}",
        "object": "chat.completion",
        "session_id": session_id,
        "model": req.model or "cassandra-interceptor",
        "cassandra": {
            "status": "intercepted",
            "decision": decision.decision,
            "score": decision.score_received,
            "threshold": decision.threshold_applied,
            "reason": decision.reason,
            "latency_seconds": elapsed,
            "mcp_responses": mcp_responses
        },
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": (
                    f"[CASSANDRA {decision.decision}] {decision.reason}"
                )
            },
            "finish_reason": "stop"
        }]
    }
