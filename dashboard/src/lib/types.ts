/**
 * TypeScript mirrors of the backend Pydantic schemas.
 * Source of truth: backend/cassandra/telemetry/event_bus.py,
 * backend/cassandra/mcp/schemas.py, backend/cassandra/agents/gatekeeper.py
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type GateVerdict = "ALLOW" | "HALT";

export type TelemetryEventType =
  | "cot_captured"
  | "perturbation_generated"
  | "divergence_scored"
  | "gate_decision"
  | "mcp_call_intercepted";

/* ── Per-event payloads (see MCPInterceptor.intercept) ──────────── */

export interface CotCapturedPayload {
  cot: string;
  tool_call_count: number;
  /** Added Phase 4.3 — absent in older recorded sessions. */
  cot_char_count?: number;
  cot_token_estimate?: number;
}

export interface PerturbationGeneratedPayload {
  counterfactual: string;
  constraint_relaxation: string;
  semantic_paraphrase: string;
  /** Injector wall-clock latency (ms). Added Phase 4.3. */
  latency_ms?: number;
}

export interface DivergenceScoredPayload {
  semantic_divergence: number;
  structural_divergence: number;
  goal_divergence: number;
  composite_score: number;
  explanation: string;
  /** Divergence Monitor latency (ms). Added Phase 4.3. */
  latency_ms?: number;
}

export interface GateDecisionPayload {
  decision: GateVerdict;
  threshold_applied: number;
  score_received: number;
  risk_level: RiskLevel;
  reason: string;
  /** Per-stage timing (ms). Added Phase 4.3. */
  injector_latency_ms?: number;
  monitor_latency_ms?: number;
  swarm_latency_ms?: number;
  total_latency_ms?: number;
}

/** JSON-RPC 2.0 error emitted on HALT (code -32001). */
export interface MCPError {
  code: number;
  message: string;
  data?: { reason?: string };
}

export interface MCPErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: MCPError;
}

export type MCPAction = "FORWARDED" | "HALTED";

export interface MCPCallInterceptedPayload {
  tool_name: string;
  action: MCPAction;
  /** Present since Phase 4.3; older HALT-only logs omit these. */
  call_id?: string | number | null;
  risk_level?: RiskLevel;
  arguments?: Record<string, unknown>;
  /** Only present on HALTED calls. */
  mcp_error?: MCPErrorResponse;
}

/* ── Event envelope (backend TelemetryEvent) ────────────────────── */

interface TelemetryEventBase {
  event_id: string;
  session_id: string;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
}

export type TelemetryEvent = TelemetryEventBase &
  (
    | { event_type: "cot_captured"; payload: CotCapturedPayload }
    | { event_type: "perturbation_generated"; payload: PerturbationGeneratedPayload }
    | { event_type: "divergence_scored"; payload: DivergenceScoredPayload }
    | { event_type: "gate_decision"; payload: GateDecisionPayload }
    | { event_type: "mcp_call_intercepted"; payload: MCPCallInterceptedPayload }
  );

/* ── Connection state exposed by the WebSocket hook ─────────────── */

export type WsStatus = "connecting" | "connected" | "disconnected";
