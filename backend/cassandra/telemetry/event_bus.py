import asyncio
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine
from pydantic import BaseModel, Field
import uuid


class TelemetryEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    event_type: str  # cot_captured, perturbation_generated, divergence_scored, gate_decision, mcp_call_intercepted
    payload: dict[str, Any] = {}


# Type alias for subscriber callbacks
Subscriber = Callable[[TelemetryEvent], Coroutine[Any, Any, None]]


class EventBus:
    """
    Async in-process pub/sub event bus.
    Agents emit events; the session store and WS broadcaster subscribe.
    """
    _instance: "EventBus | None" = None

    def __init__(self):
        self._subscribers: dict[str, list[Subscriber]] = {}
        self._global_subscribers: list[Subscriber] = []

    @classmethod
    def get(cls) -> "EventBus":
        if cls._instance is None:
            cls._instance = EventBus()
        return cls._instance

    def subscribe(self, event_type: str, callback: Subscriber):
        """Subscribe to a specific event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def subscribe_all(self, callback: Subscriber):
        """Subscribe to all event types."""
        self._global_subscribers.append(callback)

    async def emit(self, event: TelemetryEvent):
        """Fire an event to all matching subscribers."""
        tasks = []
        # Notify type-specific subscribers
        for cb in self._subscribers.get(event.event_type, []):
            tasks.append(asyncio.create_task(cb(event)))
        # Notify global subscribers
        for cb in self._global_subscribers:
            tasks.append(asyncio.create_task(cb(event)))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def reset(self):
        """Clear all subscribers (useful for testing)."""
        self._subscribers.clear()
        self._global_subscribers.clear()
