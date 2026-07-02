from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from cassandra.proxy.router import router as proxy_router
from cassandra.telemetry.replay import router as replay_router
from cassandra.telemetry.event_bus import EventBus
from cassandra.telemetry.session_store import SessionStore
from cassandra.telemetry.ws_handler import WebSocketManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: wire up telemetry subscribers
    event_bus = EventBus.get()
    session_store = SessionStore.get()
    ws_manager = WebSocketManager.get()

    event_bus.subscribe_all(session_store.on_event)
    event_bus.subscribe_all(ws_manager.on_event)

    print("[Cassandra] Telemetry pipeline initialized")
    print(f"[Cassandra] WebSocket telemetry available at ws://localhost:8000/ws/telemetry")
    yield
    # Shutdown
    print("[Cassandra] Shutting down")


app = FastAPI(
    title="Project Cassandra",
    description="CoT Steganography Interceptor — MCP Middleware",
    version="0.2.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proxy_router, prefix="/v1")
app.include_router(replay_router, prefix="/v1/telemetry")


@app.get("/health")
async def health_check():
    ws_manager = WebSocketManager.get()
    session_store = SessionStore.get()
    return {
        "status": "ok",
        "service": "cassandra-core",
        "version": "0.2.0",
        "ws_clients": ws_manager.connection_count,
        "sessions_logged": len(session_store.list_sessions())
    }


@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    ws_manager = WebSocketManager.get()
    await ws_manager.connect(websocket)
    print(f"[Cassandra] Dashboard client connected ({ws_manager.connection_count} active)")
    try:
        while True:
            # Keep the connection alive; we only push events, not receive
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        print(f"[Cassandra] Dashboard client disconnected ({ws_manager.connection_count} active)")


if __name__ == "__main__":
    uvicorn.run("cassandra.main:app", host="0.0.0.0", port=8000, reload=True)
