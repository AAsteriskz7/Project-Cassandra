"use client";

import { useState } from "react";
import { PanelHeader } from "@/components/panel";
import { Icons } from "@/components/icons";
import type { MCPCallInterceptedPayload, RiskLevel, TelemetryEvent } from "@/lib/types";

interface McpCallLogProps {
  /** Events for the active session. */
  events: TelemetryEvent[];
}

const RISK_COLORS: Record<RiskLevel, string> = {
  HIGH: "var(--halt)",
  MEDIUM: "var(--warn)",
  LOW: "var(--allow)",
};

interface Row {
  key: string;
  callId: string;
  tool: string;
  args: Record<string, unknown> | null;
  risk: RiskLevel | null;
  halted: boolean;
  reason?: string;
}

function toRows(events: TelemetryEvent[]): Row[] {
  const rows: Row[] = [];
  let seq = 0;
  for (const ev of events) {
    if (ev.event_type !== "mcp_call_intercepted") continue;
    const p = ev.payload as MCPCallInterceptedPayload;
    rows.push({
      key: ev.event_id,
      callId: p.call_id != null ? String(p.call_id) : `#${++seq}`,
      tool: p.tool_name,
      args: (p.arguments as Record<string, unknown>) ?? null,
      risk: p.risk_level ?? null,
      halted: p.action === "HALTED",
      reason: p.mcp_error?.error?.data?.reason,
    });
  }
  return rows;
}

function argPreview(args: Record<string, unknown> | null): string {
  if (!args || Object.keys(args).length === 0) return "—";
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ·  ");
}

export function McpCallLog({ events }: McpCallLogProps) {
  const rows = toRows(events);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        icon={<Icons.table size={15} />}
        title="Outbound MCP Tool Calls"
        tone={rows.some((r) => r.halted) ? "halt" : "accent"}
        right={
          <span className="font-mono text-[11px] text-muted">
            <span className="tnum">{rows.length}</span> call(s)
            {rows.some((r) => r.halted) && (
              <span className="text-halt"> · {rows.filter((r) => r.halted).length} halted</span>
            )}
          </span>
        }
      />

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm italic text-muted">No tool calls intercepted for this session.</p>
        </div>
      ) : (
        <div className="scroll-thin flex-1 overflow-auto">
          <table className="w-full border-collapse text-left font-mono text-[12px]">
            <thead className="sticky top-0 bg-[var(--surface-raised)] text-[10px] uppercase tracking-wider text-muted backdrop-blur">
              <tr>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Arguments</th>
                <th className="px-4 py-2 font-medium">Risk</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = expanded === row.key;
                return (
                  <tr
                    key={row.key}
                    onClick={() => setExpanded(isOpen ? null : row.key)}
                    className="cursor-pointer border-t border-glass-border align-top transition-colors hover:bg-[var(--glass-highlight)]"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-foreground">{row.tool}</span>
                      <span className="block text-[10px] text-[var(--muted-strong)]">{row.callId}</span>
                    </td>
                    <td className="max-w-0 px-4 py-2.5 text-foreground/70">
                      <div className={isOpen ? "whitespace-pre-wrap break-all" : "truncate"}>
                        {isOpen && row.args
                          ? JSON.stringify(row.args, null, 2)
                          : argPreview(row.args)}
                      </div>
                      {isOpen && row.halted && row.reason && (
                        <div className="mt-2 rounded border-l-2 border-[var(--halt)] bg-[rgba(248,113,113,0.08)] px-2 py-1 text-[11px] text-halt">
                          -32001 · {row.reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.risk ? (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: RISK_COLORS[row.risk],
                            background: "var(--surface-raised)",
                            border: `1px solid ${RISK_COLORS[row.risk]}`,
                          }}
                        >
                          {row.risk}
                        </span>
                      ) : (
                        <span className="text-[var(--muted-strong)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide"
                        style={{
                          color: row.halted ? "var(--halt)" : "var(--allow)",
                          background: row.halted
                            ? "rgba(248,113,113,0.12)"
                            : "rgba(52,211,153,0.12)",
                          border: `1px solid ${row.halted ? "var(--halt)" : "var(--allow)"}`,
                          boxShadow: `0 0 10px ${row.halted ? "var(--halt-glow)" : "var(--allow-glow)"}`,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: row.halted ? "var(--halt)" : "var(--allow)" }}
                        />
                        {row.halted ? "HALT" : "ALLOW"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
