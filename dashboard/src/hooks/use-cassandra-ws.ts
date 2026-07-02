"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TelemetryEvent, TelemetryEventType, WsStatus } from "@/lib/types";

const WS_URL = "ws://localhost:8000/ws/telemetry";
const MAX_EVENTS = 500;
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 15000;

const VALID_EVENT_TYPES: ReadonlySet<string> = new Set<TelemetryEventType>([
  "cot_captured",
  "perturbation_generated",
  "divergence_scored",
  "gate_decision",
  "mcp_call_intercepted",
]);

function parseEvent(raw: string): TelemetryEvent | null {
  try {
    const data = JSON.parse(raw);
    if (
      typeof data?.event_id === "string" &&
      typeof data?.session_id === "string" &&
      VALID_EVENT_TYPES.has(data?.event_type)
    ) {
      return data as TelemetryEvent;
    }
    console.warn("[cassandra-ws] Dropping malformed event:", data);
    return null;
  } catch {
    console.warn("[cassandra-ws] Dropping unparseable frame:", raw.slice(0, 200));
    return null;
  }
}

export interface CassandraWsState {
  status: WsStatus;
  /** All events, oldest first, capped at MAX_EVENTS. */
  events: TelemetryEvent[];
  /** Events grouped by session_id, in arrival order. */
  sessions: Record<string, TelemetryEvent[]>;
  /** session_id of the most recently active session. */
  activeSessionId: string | null;
  lastEvent: TelemetryEvent | null;
  reconnectAttempts: number;
  clearEvents: () => void;
}

export function useCassandraWs(url: string = WS_URL): CassandraWsState {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const closedByUnmountRef = useRef(false);

  const clearEvents = useCallback(() => setEvents([]), []);

  useEffect(() => {
    closedByUnmountRef.current = false;

    const connect = () => {
      if (closedByUnmountRef.current) return;
      setStatus("connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        setReconnectAttempts(0);
        setStatus("connected");
      };

      ws.onmessage = (msg: MessageEvent<string>) => {
        const event = parseEvent(msg.data);
        if (!event) return;
        setEvents((prev) => {
          const next = [...prev, event];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUnmountRef.current) return;
        setStatus("disconnected");
        // Exponential backoff reconnect
        const delay = Math.min(
          BASE_RECONNECT_MS * 2 ** attemptRef.current,
          MAX_RECONNECT_MS
        );
        attemptRef.current += 1;
        setReconnectAttempts(attemptRef.current);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose fires after onerror; reconnection is handled there.
        ws.close();
      };
    };

    connect();

    return () => {
      closedByUnmountRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [url]);

  // Derive per-session grouping from the flat event list
  const sessions: Record<string, TelemetryEvent[]> = {};
  for (const ev of events) {
    (sessions[ev.session_id] ??= []).push(ev);
  }
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  return {
    status,
    events,
    sessions,
    activeSessionId: lastEvent?.session_id ?? null,
    lastEvent,
    reconnectAttempts,
    clearEvents,
  };
}
