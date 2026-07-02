"use client";

import type { GateVerdict, TelemetryEvent, TelemetryEventType } from "@/lib/types";

interface SessionTimelineProps {
  /** Events belonging to the active session, in arrival order. */
  events: TelemetryEvent[];
}

type StageStatus = "pending" | "active" | "complete";

interface Stage {
  key: string;
  label: string;
  eventTypes: TelemetryEventType[];
}

const STAGES: Stage[] = [
  { key: "intercepted", label: "Request Intercepted", eventTypes: ["cot_captured"] },
  { key: "analyzing", label: "Swarm Analyzing", eventTypes: ["perturbation_generated", "divergence_scored"] },
  { key: "decision", label: "Gate Decision", eventTypes: ["gate_decision", "mcp_call_intercepted"] },
];

function stageIndexOf(eventType: TelemetryEventType): number {
  return STAGES.findIndex((s) => s.eventTypes.includes(eventType));
}

function statusStyles(status: StageStatus, verdict: GateVerdict | null) {
  if (status === "pending") {
    return {
      dot: "border-[var(--glass-border-strong)] bg-transparent",
      label: "text-muted",
      glow: "",
    };
  }
  const color =
    verdict === "HALT" ? "var(--halt)" : verdict === "ALLOW" ? "var(--allow)" : "var(--accent)";
  const glowVar =
    verdict === "HALT" ? "var(--halt-glow)" : verdict === "ALLOW" ? "var(--allow-glow)" : "var(--accent-glow)";
  return {
    dot: "",
    dotStyle: {
      borderColor: color,
      background: status === "complete" ? color : "transparent",
      boxShadow: `0 0 10px ${glowVar}`,
    },
    label: "text-foreground",
    color,
  };
}

export function SessionTimeline({ events }: SessionTimelineProps) {
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const reachedIndex = lastEvent ? stageIndexOf(lastEvent.event_type) : -1;

  const gateEvent = events.find((e) => e.event_type === "gate_decision");
  const verdict: GateVerdict | null =
    gateEvent?.event_type === "gate_decision" ? gateEvent.payload.decision : null;
  const divergenceEvent = events.find((e) => e.event_type === "divergence_scored");
  const cotEvent = events.find((e) => e.event_type === "cot_captured");
  const haltedTools = events
    .filter((e) => e.event_type === "mcp_call_intercepted")
    .map((e) => (e.event_type === "mcp_call_intercepted" ? e.payload.tool_name : ""));

  // A stage is complete once a later stage has begun (or the gate has ruled);
  // the furthest stage reached is "active" while the session is still open.
  const sessionSettled = verdict !== null;
  const statuses: StageStatus[] = STAGES.map((_, i) => {
    if (i < reachedIndex) return "complete";
    if (i === reachedIndex) return sessionSettled && i === STAGES.length - 1 ? "complete" : "active";
    return "pending";
  });

  const sublabels: (string | null)[] = [
    cotEvent?.event_type === "cot_captured"
      ? `CoT captured · ${cotEvent.payload.tool_call_count} tool call(s)`
      : null,
    divergenceEvent?.event_type === "divergence_scored"
      ? `divergence ${divergenceEvent.payload.composite_score.toFixed(3)}`
      : statuses[1] === "active"
        ? "injecting perturbations…"
        : null,
    verdict
      ? verdict === "HALT"
        ? `HALT — ${haltedTools.length > 0 ? haltedTools.join(", ") : "execution blocked"}`
        : "ALLOW — forwarded to tool"
      : statuses[2] === "active"
        ? "evaluating…"
        : null,
  ];

  return (
    <ol className="flex w-full items-start">
      {STAGES.map((stage, i) => {
        const status = statuses[i];
        // Only color the final stage by the verdict; earlier stages stay accent.
        const s = statusStyles(status, i === STAGES.length - 1 ? verdict : null);
        return (
          <li key={stage.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center text-center">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${s.dot} ${
                  status === "active" ? "animate-pulse" : ""
                }`}
                style={"dotStyle" in s ? s.dotStyle : undefined}
              >
                {status === "complete" && (
                  <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none">
                    <path d="M1.5 5.5l2.2 2.2L8.5 2.5" stroke="var(--background)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span className={`mt-2 text-xs font-medium ${s.label}`}>{stage.label}</span>
              <span className="mt-0.5 h-4 font-mono text-[10px] text-muted">
                {sublabels[i] ?? ""}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className="mt-2.5 h-0.5 flex-1 rounded-full transition-colors duration-500"
                style={{
                  background:
                    statuses[i + 1] !== "pending"
                      ? "var(--accent)"
                      : status !== "pending"
                        ? "linear-gradient(to right, var(--accent), var(--glass-border))"
                        : "var(--glass-border)",
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
