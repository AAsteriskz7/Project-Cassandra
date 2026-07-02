from fastapi import WebSocket, WebSocketDisconnect
from cassandra.telemetry.event_bus import TelemetryEvent
import json


class WebSocketManager:
    """
    Manages WebSocket connections from dashboard clients.
    Subscribes to the EventBus and broadcasts all events.
    """
    _instance: "WebSocketManager | None" = None

    def __init__(self):
        self._connections: list[WebSocket] = []

    @classmethod
    def get(cls) -> "WebSocketManager":
        if cls._instance is None:
            cls._instance = WebSocketManager()
        return cls._instance

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def on_event(self, event: TelemetryEvent):
        """Event bus callback — broadcasts to all connected WS clients."""
        data = event.model_dump_json()
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)
