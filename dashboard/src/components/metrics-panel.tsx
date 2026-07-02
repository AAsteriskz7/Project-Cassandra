"use client";

import { PanelHeader } from "@/components/panel";
import { Icons } from "@/components/icons";
import type { TelemetryEvent } from "@/lib/types";

interface MetricsPanelProps {
  /** All events seen this dashboard session (for running averages). */
  events: TelemetryEvent[];
  /** Events for the currently active session. */
  activeEvents: TelemetryEvent[];
}

function fmtMs(ms: number | undefined): string {
  if (ms === undefined) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass flex flex-col justify-between px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <span
        className="mt-1 font-mono text-xl font-semibold tabular-nums"
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {value}
      </span>
      <span className="h-3.5 font-mono text-[10px] text-muted">{sub ?? ""}</span>
    </div>
  );
}

function LatencyBar({ label, ms, max, color }: { label: string; ms: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((ms / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 font-mono text-[10px] text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-border)]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <span className="w-14 text-right font-mono text-[10px] text-foreground/80">{fmtMs(ms)}</span>
    </div>
  );
}

export function MetricsPanel({ events, activeEvents }: MetricsPanelProps) {
  // ── Active-session timing ──
  const gate = activeEvents.find((e) => e.event_type === "gate_decision");
  const cot = activeEvents.find((e) => e.event_type === "cot_captured");
  const pert = activeEvents.find((e) => e.event_type === "perturbation_generated");
  const div = activeEvents.find((e) => e.event_type === "divergence_scored");

  const gp = gate?.event_type === "gate_decision" ? gate.payload : null;
  const injectorMs =
    gp?.injector_latency_ms ?? (pert?.event_type === "perturbation_generated" ? pert.payload.latency_ms : undefined);
  const monitorMs =
    gp?.monitor_latency_ms ?? (div?.event_type === "divergence_scored" ? div.payload.latency_ms : undefined);
  const derivedSwarm = (injectorMs ?? 0) + (monitorMs ?? 0);
  const swarmMs = gp?.swarm_latency_ms ?? (derivedSwarm > 0 ? derivedSwarm : undefined);
  const totalMs = gp?.total_latency_ms ?? swarmMs;
  const overheadMs =
    totalMs !== undefined && swarmMs !== undefined ? Math.max(0, totalMs - swarmMs) : undefined;

  const tokenEst =
    cot?.event_type === "cot_captured"
      ? cot.payload.cot_token_estimate ?? Math.round(cot.payload.cot.length / 4)
      : undefined;
  const throughput =
    tokenEst !== undefined && swarmMs && swarmMs > 0 ? tokenEst / (swarmMs / 1000) : undefined;

  // ── Running aggregates across all sessions seen ──
  const compositeScores = events
    .filter((e) => e.event_type === "divergence_scored")
    .map((e) => (e.event_type === "divergence_scored" ? e.payload.composite_score : 0));
  const avgDivergence =
    compositeScores.length > 0
      ? compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length
      : undefined;

  const gateEvents = events.filter((e) => e.event_type === "gate_decision");
  const haltCount = gateEvents.filter(
    (e) => e.event_type === "gate_decision" && e.payload.decision === "HALT"
  ).length;
  const haltRate = gateEvents.length > 0 ? (haltCount / gateEvents.length) * 100 : undefined;

  const latMax = Math.max(injectorMs ?? 0, monitorMs ?? 0, 1);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader icon={<Icons.metrics size={15} />} title="System Metrics" />

      <div className="flex-1 space-y-3 overflow-auto p-4 scroll-thin">
        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            label="Total Latency"
            value={fmtMs(totalMs)}
            sub={overheadMs !== undefined ? `swarm ${fmtMs(swarmMs)} · io ${fmtMs(overheadMs)}` : undefined}
            accent="var(--accent)"
          />
          <Tile
            label="Reasoning Tput"
            value={throughput !== undefined ? `${throughput.toFixed(1)}` : "—"}
            sub={throughput !== undefined ? "tokens / sec" : undefined}
          />
          <Tile
            label="Avg Divergence"
            value={avgDivergence !== undefined ? avgDivergence.toFixed(3) : "—"}
            sub={`${compositeScores.length} sample(s)`}
            accent={
              avgDivergence !== undefined && avgDivergence >= 0.5 ? "var(--halt)" : "var(--allow)"
            }
          />
          <Tile
            label="HALT Rate"
            value={haltRate !== undefined ? `${Math.round(haltRate)}%` : "—"}
            sub={`${haltCount}/${gateEvents.length} session(s)`}
            accent={haltRate !== undefined && haltRate > 0 ? "var(--halt)" : "var(--allow)"}
          />
        </div>

        {/* Per-agent swarm overhead breakdown */}
        <div className="glass space-y-2 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Swarm Overhead Breakdown
          </p>
          <LatencyBar label="Injector" ms={injectorMs ?? 0} max={latMax} color="var(--accent)" />
          <LatencyBar label="Monitor" ms={monitorMs ?? 0} max={latMax} color="var(--warn)" />
        </div>

        {/* CoT size */}
        <div className="glass flex items-center justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            CoT Size
          </span>
          <span className="font-mono text-sm text-foreground/85">
            {cot?.event_type === "cot_captured"
              ? `${tokenEst} tok · ${cot.payload.cot_char_count ?? cot.payload.cot.length} chars`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
