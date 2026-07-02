"use client";

import { useState } from "react";
import { useCassandraWs } from "@/hooks/use-cassandra-ws";
import { DivergenceGauge } from "@/components/divergence-gauge";
import { SessionTimeline } from "@/components/session-timeline";
import { CotStream } from "@/components/cot-stream";
import { PerturbationDiff } from "@/components/perturbation-diff";
import { McpCallLog } from "@/components/mcp-call-log";
import { MetricsPanel } from "@/components/metrics-panel";
import { PanelHeader } from "@/components/panel";
import { BrandMark, Icons } from "@/components/icons";
import type { WsStatus } from "@/lib/types";

const BACKEND_URL = "http://localhost:8000";

const STATUS_META: Record<WsStatus, { color: string; label: string; live: boolean }> = {
  connected: { color: "var(--allow)", label: "LIVE", live: true },
  connecting: { color: "var(--warn)", label: "LINKING", live: false },
  disconnected: { color: "var(--halt)", label: "OFFLINE", live: false },
};

export default function Home() {
  const { status, events, sessions, activeSessionId, reconnectAttempts, clearEvents } =
    useCassandraWs();
  const [replayStatus, setReplayStatus] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  const statusMeta = STATUS_META[status];
  const sessionCount = Object.keys(sessions).length;
  const activeEvents = activeSessionId ? sessions[activeSessionId] : [];

  // ── Typed slices of the active session ──
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
        setReplayStatus(`error · ${data?.detail ?? r.status}`);
      } else {
        setReplayStatus(`streaming ${data.event_count} events · ${String(data.source_session_id).slice(0, 8)}`);
        setTimeout(() => setReplaying(false), data.event_count * 1000 + 500);
        return;
      }
    } catch {
      setReplayStatus("error · backend unreachable at :8000");
    }
    setReplaying(false);
  };

  return (
    <>
      <div className="verdict-vignette" data-verdict={decision ?? ""} />

      <main className="mx-auto grid w-full max-w-[128rem] grid-cols-1 gap-4 p-4 sm:p-5 xl:grid-cols-12">
        {/* ══ Command bar ══ */}
        <header className="glass glow-accent rise col-span-full flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="text-accent" style={{ filter: "drop-shadow(0 0 10px var(--accent-glow))" }}>
              <BrandMark size={32} />
            </span>
            <div className="leading-tight">
              <h1
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                PROJECT CASSANDRA
              </h1>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
                CoT Steganography Interceptor
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs">
            <Metric label="sessions" value={sessionCount} />
            <Metric label="events" value={events.length} />
            <span className="h-6 w-px bg-[var(--glass-border)]" />
            <span className="flex items-center gap-2" style={{ color: statusMeta.color }}>
              <span
                className={`h-2 w-2 rounded-full ${statusMeta.live ? "live-dot" : ""}`}
                style={{ background: statusMeta.color, color: statusMeta.color }}
              />
              <span className="font-semibold tracking-widest">{statusMeta.label}</span>
              {status === "disconnected" && reconnectAttempts > 0 && (
                <span className="text-muted">· retry {reconnectAttempts}</span>
              )}
            </span>
            <button
              onClick={triggerReplay}
              disabled={replaying}
              className="group flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--glass-border-strong)] bg-[oklch(82%_0.14_200_/_0.08)] px-3.5 py-1.5 font-semibold tracking-wide text-accent transition-all hover:bg-[oklch(82%_0.14_200_/_0.16)] hover:shadow-[0_0_20px_-4px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className={replaying ? "animate-pulse" : ""}>
                {replaying ? <Icons.radar size={14} /> : <Icons.play size={13} />}
              </span>
              {replaying ? "REPLAYING" : "REPLAY"}
            </button>
            <button
              onClick={clearEvents}
              aria-label="Clear telemetry"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-muted transition-colors hover:text-foreground"
            >
              <Icons.trash size={14} />
            </button>
          </div>
        </header>

        {/* ══ Timeline ══ */}
        <section className="glass rise col-span-full" style={{ animationDelay: "40ms" }}>
          <PanelHeader
            icon={<Icons.activity size={15} />}
            title="Session Lifecycle"
            tone={decision === "HALT" ? "halt" : decision === "ALLOW" ? "allow" : "accent"}
            right={
              activeSessionId ? (
                <span className="font-mono text-[11px] text-accent">{activeSessionId}</span>
              ) : (
                <span className="font-mono text-[11px] text-muted-strong">idle</span>
              )
            }
          />
          <div className="px-7 py-5">
            {activeEvents.length === 0 ? (
              <EmptyLine text="No active session — trigger REPLAY or send a request through the proxy." />
            ) : (
              <SessionTimeline events={activeEvents} />
            )}
          </div>
        </section>

        {/* ══ Row 1 · CoT stream + gauge ══ */}
        <section className="glass rise col-span-full h-[22rem] xl:col-span-8" style={{ animationDelay: "80ms" }}>
          <CotStream cot={cot?.cot ?? null} tokenEstimate={cot?.cot_token_estimate} toolCallCount={cot?.tool_call_count} />
        </section>
        <section
          className={`glass rise col-span-full flex flex-col xl:col-span-4 ${
            decision === "HALT" ? "glow-halt" : decision === "ALLOW" ? "glow-allow" : "glow-accent"
          }`}
          style={{ animationDelay: "120ms" }}
        >
          <PanelHeader
            icon={<Icons.gauge size={15} />}
            title="Divergence Monitor"
            tone={decision === "HALT" ? "halt" : decision === "ALLOW" ? "allow" : "accent"}
          />
          <div className="flex flex-1 items-center justify-center py-4">
            <DivergenceGauge score={score} threshold={threshold} decision={decision} riskLevel={riskLevel} />
          </div>
        </section>

        {/* ══ Row 2 · Perturbation diff + metrics ══ */}
        <section className="glass rise col-span-full h-[27rem] xl:col-span-8" style={{ animationDelay: "160ms" }}>
          <PerturbationDiff originalCot={cot?.cot ?? null} perturbations={perturbations} divergence={divergence} />
        </section>
        <section className="glass rise col-span-full h-[27rem] xl:col-span-4" style={{ animationDelay: "200ms" }}>
          <MetricsPanel events={events} activeEvents={activeEvents} />
        </section>

        {/* ══ Row 3 · MCP log + raw stream ══ */}
        <section className="glass rise col-span-full h-[22rem] xl:col-span-8" style={{ animationDelay: "240ms" }}>
          <McpCallLog events={activeEvents} />
        </section>
        <section className="glass rise col-span-full flex h-[22rem] flex-col xl:col-span-4" style={{ animationDelay: "280ms" }}>
          <PanelHeader
            icon={<Icons.terminal size={15} />}
            title="Raw Telemetry"
            right={replayStatus && <span className="font-mono text-[10px] text-muted">{replayStatus}</span>}
          />
          <pre className="scroll-thin flex-1 overflow-auto p-4 font-mono text-[10.5px] leading-relaxed text-foreground/70">
            {events.length === 0
              ? "// awaiting telemetry stream…"
              : events.map((ev) => JSON.stringify(ev)).join("\n\n")}
          </pre>
        </section>
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-muted">
      {label} <span className="tnum ml-0.5 text-foreground">{value}</span>
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
      <Icons.radar size={15} className="text-muted-strong" />
      {text}
    </div>
  );
}
