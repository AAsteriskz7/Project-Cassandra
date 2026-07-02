"""
Replay Engine — re-streams recorded telemetry sessions over the live
WebSocket so the dashboard can be developed without burning LLM quota.

Replayed events are broadcast directly through the WebSocketManager
(bypassing the EventBus) so they are NOT re-persisted by the SessionStore.
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cassandra.telemetry.event_bus import TelemetryEvent
from cassandra.telemetry.session_store import SessionStore
from cassandra.telemetry.ws_handler import WebSocketManager

router = APIRouter()


class ReplayRequest(BaseModel):
    session_id: str | None = None  # None -> latest completed session on disk
    delay_seconds: float = Field(default=1.0, ge=0.0, le=10.0)
    # Re-mint session/event ids and timestamps so the frontend
    # renders the replay as a brand-new live session.
    fresh_session: bool = True


def _log_dir() -> Path:
    return SessionStore.get().log_dir


def _load_session_file(path: Path) -> list[TelemetryEvent]:
    events: list[TelemetryEvent] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(TelemetryEvent(**json.loads(line)))
        except (json.JSONDecodeError, ValueError):
            continue  # skip corrupt lines rather than failing the replay
    return events


def _is_completed(events: list[TelemetryEvent]) -> bool:
    return any(e.event_type == "gate_decision" for e in events)


def _find_latest_completed() -> tuple[str, list[TelemetryEvent]] | None:
    files = sorted(_log_dir().glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    for path in files:
        events = _load_session_file(path)
        if _is_completed(events):
            return path.stem, events
    return None


async def _stream_events(
    events: list[TelemetryEvent],
    delay_seconds: float,
    fresh_session: bool
):
    ws_manager = WebSocketManager.get()
    replay_session_id = str(uuid.uuid4()) if fresh_session else events[0].session_id

    for event in events:
        out = event
        if fresh_session:
            out = event.model_copy(update={
                "event_id": str(uuid.uuid4()),
                "session_id": replay_session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        await ws_manager.on_event(out)
        await asyncio.sleep(delay_seconds)


@router.get("/sessions")
async def list_recorded_sessions():
    """List all sessions available on disk for replay."""
    sessions = []
    for path in sorted(_log_dir().glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        events = _load_session_file(path)
        decision = next(
            (e.payload.get("decision") for e in events if e.event_type == "gate_decision"),
            None
        )
        sessions.append({
            "session_id": path.stem,
            "event_count": len(events),
            "completed": _is_completed(events),
            "decision": decision,
            "recorded_at": events[0].timestamp if events else None,
        })
    return {"sessions": sessions}


@router.post("/replay")
async def replay_session(req: ReplayRequest):
    """
    Re-stream a recorded session over /ws/telemetry as if it were live.
    Returns immediately; events stream in the background with the
    requested inter-event delay.
    """
    if req.session_id:
        path = _log_dir() / f"{req.session_id}.jsonl"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Session {req.session_id} not found")
        source_id, events = req.session_id, _load_session_file(path)
    else:
        found = _find_latest_completed()
        if found is None:
            raise HTTPException(status_code=404, detail="No completed sessions recorded yet")
        source_id, events = found

    if not events:
        raise HTTPException(status_code=404, detail=f"Session {source_id} has no events")

    asyncio.create_task(_stream_events(events, req.delay_seconds, req.fresh_session))

    return {
        "status": "replay_started",
        "source_session_id": source_id,
        "event_count": len(events),
        "delay_seconds": req.delay_seconds,
        "ws_clients": WebSocketManager.get().connection_count,
    }


@router.post("/replay/all")
async def replay_all_sessions(req: ReplayRequest):
    """
    Re-stream the last 5 completed sessions sequentially.
    """
    files = sorted(_log_dir().glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    sessions_to_replay = []
    for path in files:
        events = _load_session_file(path)
        if _is_completed(events):
            sessions_to_replay.append(events)
        if len(sessions_to_replay) >= 5:
            break
            
    if not sessions_to_replay:
        raise HTTPException(status_code=404, detail="No completed sessions found")
        
    sessions_to_replay.reverse() # Play oldest to newest
    total_events = sum(len(evs) for evs in sessions_to_replay)
    
    async def _stream_all():
        for events in sessions_to_replay:
            await _stream_events(events, req.delay_seconds, req.fresh_session)
            await asyncio.sleep(2.0)
            
    asyncio.create_task(_stream_all())
    
    return {
        "status": "replay_all_started",
        "session_count": len(sessions_to_replay),
        "event_count": total_events,
        "delay_seconds": req.delay_seconds,
        "ws_clients": WebSocketManager.get().connection_count,
    }
