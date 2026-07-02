"use client";

import { useState } from "react";
import { useCassandraWs } from "@/hooks/use-cassandra-ws";
import { DivergenceGauge } from "@/components/divergence-gauge";
import { SessionTimeline } from "@/components/session-timeline";
import { CotStream } from "@/components/cot-stream";
import { PerturbationDiff } from "@/components/perturbation-diff";
import { McpCallLog } from "@/components/mcp-call-log";
import { MetricsPanel } from "@/components/metrics-panel";
import type { WsStatus } from "@/lib/types";

const BACKEND_URL = "http://localhost:8000";

const STATUS_STYLES: Record<WsStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-allow shadow-[0_0_8px_var(--allow-glow)]", label: "Connected" },
  connecting: { dot: "bg-warn shadow-[0_0_8px_var(--warn-glow)] animate-pulse", label: "Connecting…" },
  disconnected: { dot: "bg-halt shadow-[0_0_8px_var(--halt-glow)]", label: "Disconnected" },
};

export default function Home() {
  const { status, events, sessions, activeSessionId, reconnectAttempts, clearEvents } =
    useCassandraWs();
  const [replayStatus, setReplayStatus] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  const statusStyle = STATUS_STYLES[status];
  const sessionCount = Object.keys(sessions).length;
  const activeEvents = activeSessionId ? sessions[activeSessionId] : [];

  // ── Derive typed slices of the active session for each panel ──
  const cotEvent = activeEvents.find((e) => e.event_type === "cot_captured");
  const pertEvent = activeEvents.find((e) => e.event_type === "perturbation_generated");
  const divEvent = activeEvents.find((e) => e.event_type === "divergence_scored");
  const gateEvent = activeEvents.find((e) => e.event_type === "gate_decision");

  const cot = cotEvent?.event_type === "cot_captured" ? cotEvent.payload : null;
  const perturbations = pertEvent?.event_type === "perturbation_generated" ? pertEvent.payload : null;
  const divergence = divEvent?.event_type === "divergence_scored" ? divEvent.payload : null;
  const gate = gateEvent?.event_type === "gate_decision" ? gateEvent.payload : null;

  const score = divergence?.composite_score ?? null;
  const threshold = gate?.threshold_applied ?? null;
  const decision = gate?.decision ?? null;
  const riskLevel = gate?.risk_level ?? null;

  const triggerReplay = async () => {
    setReplaying(true);
    setReplayStatus(null);
    try {
      const r = await fetch(`${BACKEND_URL}/v1/telemetry/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delay_seconds: 1.0 }),
      });
      const data = await r.json();
      if (!r.ok) {
        setReplayStatus(`Error: ${data?.detail ?? r.status}`);
      } else {
        setReplayStatus(
          `Replaying ${data.event_count} events from ${String(data.source_session_id).slice(0, 8)}…`
        );
        setTimeout(() => setReplaying(false), data.event_count * 1000 + 500);
        return;
      }
    } catch {
      setReplayStatus("Error: backend unreachable at :8000");
    }
    setReplaying(false);
  };

  return (
    <main className="mx-auto grid w-full max-w-[120rem] grid-cols-1 gap-4 p-5 xl:grid-cols-12">
      {/* ── Header ── */}
      <header className="glass glow-accent col-span-full flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Project Cassandra</h1>
          <p className="text-sm text-muted">CoT Steganography Interceptor — Live Telemetry</p>
        </div>
        <div className="flex items-center gap-5 font-mono text-sm">
          <span className="text-muted">
            sessions: <span className="text-foreground">{sessionCount}</span>
          </span>
          <span className="text-muted">
            events: <span className="text-foreground">{events.length}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
            {status === "disconnected" && reconnectAttempts > 0 && (
              <span className="text-muted">(retry #{reconnectAttempts})</span>
            )}
          </span>
          <button
            onClick={triggerReplay}
            disabled={replaying}
            className="glass glow-accent cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {replaying ? "Replaying…" : "▶ Replay Last Session"}
          </button>
          <button
            onClick={clearEvents}
            className="glass cursor-pointer px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </header>

      {replayStatus && (
        <p className="col-span-full -mt-1 font-mono text-[11px] text-muted">{replayStatus}</p>
      )}

      {/* ── Timeline (full width) ── */}
      <section className="glass col-span-full px-8 py-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Session Lifecycle</h2>
          {activeSessionId && (
            <span className="font-mono text-[11px] text-accent">{activeSessionId}</span>
          )}
        </div>
        {activeEvents.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">
            No active session — hit “Replay Last Session” or send a request through the proxy.
          </p>
        ) : (
          <SessionTimeline events={activeEvents} />
        )}
      </section>

      {/* ── Row 1: CoT stream (wide) + Divergence gauge ── */}
      <section className="glass col-span-full h-[22rem] xl:col-span-8">
        <CotStream
          cot={cot?.cot ?? null}
          tokenEstimate={cot?.cot_token_estimate}
          toolCallCount={cot?.tool_call_count}
        />
      </section>
      <section
        className={`glass col-span-full flex flex-col items-center px-5 py-5 xl:col-span-4 ${
          decision === "HALT" ? "glow-halt" : decision === "ALLOW" ? "glow-allow" : ""
        }`}
      >
        <h2 className="mb-2 self-start text-sm font-medium text-muted">Divergence Monitor</h2>
        <div className="flex flex-1 items-center">
          <DivergenceGauge score={score} threshold={threshold} decision={decision} riskLevel={riskLevel} />
        </div>
      </section>

      {/* ── Row 2: Perturbation diff (wide) + Metrics ── */}
      <section className="glass col-span-full h-[26rem] xl:col-span-8">
        <PerturbationDiff
          originalCot={cot?.cot ?? null}
          perturbations={perturbations}
          divergence={divergence}
        />
      </section>
      <section className="glass col-span-full h-[26rem] xl:col-span-4">
        <MetricsPanel events={events} activeEvents={activeEvents} />
      </section>

      {/* ── Row 3: MCP call log (wide) + raw stream ── */}
      <section className="glass col-span-full h-[22rem] xl:col-span-8">
        <McpCallLog events={activeEvents} />
      </section>
      <section className="glass col-span-full flex h-[22rem] flex-col xl:col-span-4">
        <div className="border-b border-glass-border px-5 py-3">
          <h2 className="text-sm font-medium text-muted">Raw Event Stream</h2>
        </div>
        <pre className="scroll-thin flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-foreground/80">
          {events.length === 0
            ? "Waiting for telemetry…"
            : events.map((ev) => JSON.stringify(ev)).join("\n\n")}
        </pre>
      </section>
    </main>
  );
}
