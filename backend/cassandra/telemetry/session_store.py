import json
import os
from datetime import datetime, timezone
from pathlib import Path
from cassandra.telemetry.event_bus import TelemetryEvent


class SessionStore:
    """
    Persists session telemetry as JSONL files on local disk.
    Each session (one intercepted request lifecycle) gets its own log file.
    """
    _instance: "SessionStore | None" = None

    def __init__(self, log_dir: str | None = None):
        if log_dir is None:
            log_dir = os.path.join(os.path.dirname(__file__), "..", "..", "telemetry_logs")
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._sessions: dict[str, list[TelemetryEvent]] = {}

    @classmethod
    def get(cls) -> "SessionStore":
        if cls._instance is None:
            cls._instance = SessionStore()
        return cls._instance

    async def on_event(self, event: TelemetryEvent):
        """Event bus callback — stores the event in memory and appends to disk."""
        session_id = event.session_id

        # In-memory accumulation
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        self._sessions[session_id].append(event)

        # Append to JSONL file on disk
        log_file = self.log_dir / f"{session_id}.jsonl"
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(event.model_dump_json() + "\n")

    def get_session(self, session_id: str) -> list[TelemetryEvent]:
        return self._sessions.get(session_id, [])

    def list_sessions(self) -> list[str]:
        return list(self._sessions.keys())
