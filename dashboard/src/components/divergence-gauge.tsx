"use client";

import { useEffect, useRef, useState } from "react";
import type { GateVerdict } from "@/lib/types";

interface DivergenceGaugeProps {
  score: number | null;
  threshold: number | null;
  decision: GateVerdict | null;
  riskLevel?: string | null;
}

const DEFAULT_THRESHOLD = 0.6;
const ANIM_MS = 1000;

const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R;
const ARC_FRACTION = 0.75; // 270° arc, gap at the bottom
const ARC_LEN = CIRCUMFERENCE * ARC_FRACTION;
const ROTATION = 90 + (360 * (1 - ARC_FRACTION)) / 2;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function zone(value: number, threshold: number, decision: GateVerdict | null) {
  if (decision === "HALT" || value >= threshold) {
    return { stroke: "var(--halt)", glow: "var(--halt-glow)", label: "CRITICAL" };
  }
  if (value >= threshold * 0.75) {
    return { stroke: "var(--warn)", glow: "var(--warn-glow)", label: "ELEVATED" };
  }
  return { stroke: "var(--allow)", glow: "var(--allow-glow)", label: "NOMINAL" };
}

export function DivergenceGauge({ score, threshold, decision, riskLevel }: DivergenceGaugeProps) {
  const [displayed, setDisplayed] = useState(0);
  const animRef = useRef<number>(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = score ?? 0;
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / ANIM_MS, 1);
      setDisplayed(from + (target - from) * easeOutCubic(t));
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  const effThreshold = threshold ?? DEFAULT_THRESHOLD;
  const z = zone(displayed, effThreshold, score !== null ? decision : null);
  const clamped = Math.max(0, Math.min(displayed, 1));
  const thresholdAngle = ROTATION + 360 * ARC_FRACTION * Math.min(effThreshold, 1);

  // Tick ring — 40 ticks along the 270° arc.
  // Round coordinates to a fixed precision so SSR and client hydration match
  // (raw Math.cos/sin float strings differ in their last digit between Node and the browser).
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const ticks = Array.from({ length: 41 }, (_, i) => {
    const frac = i / 40;
    const angle = (ROTATION + 360 * ARC_FRACTION * frac) * (Math.PI / 180);
    const active = frac <= clamped;
    const inner = active ? R - 20 : R - 16;
    const outer = R - 12;
    return {
      x1: r3(110 + Math.cos(angle) * inner),
      y1: r3(110 + Math.sin(angle) * inner),
      x2: r3(110 + Math.cos(angle) * outer),
      y2: r3(110 + Math.sin(angle) * outer),
      active,
    };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="228" height="228" viewBox="0 0 220 220">
          <defs>
            <linearGradient id="gauge-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="220" y2="220">
              <stop offset="0%" stopColor="var(--allow)" />
              <stop offset="55%" stopColor="var(--warn)" />
              <stop offset="100%" stopColor="var(--halt)" />
            </linearGradient>
          </defs>

          {/* Tick ring */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.active ? z.stroke : "var(--glass-border-strong)"}
              strokeWidth={t.active ? 2.2 : 1.4}
              strokeLinecap="round"
              opacity={t.active ? 1 : 0.5}
              style={{ transition: "stroke 300ms ease" }}
            />
          ))}

          {/* Track */}
          <circle
            cx="110" cy="110" r={R} fill="none"
            stroke="var(--glass-border)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE}`}
            transform={`rotate(${ROTATION} 110 110)`}
          />
          {/* Value arc */}
          <circle
            cx="110" cy="110" r={R} fill="none"
            stroke={decision === "HALT" ? "var(--halt)" : "url(#gauge-grad)"}
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${ARC_LEN * clamped} ${CIRCUMFERENCE}`}
            transform={`rotate(${ROTATION} 110 110)`}
            style={{ filter: `drop-shadow(0 0 10px ${z.glow})` }}
          />
          {/* Threshold marker */}
          <g transform={`rotate(${thresholdAngle + 90} 110 110)`} opacity={threshold !== null ? 1 : 0.3}>
            <line x1="110" y1={110 - R - 8} x2="110" y2={110 - R + 12} stroke="var(--halt)" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="tnum text-[2.6rem] font-semibold leading-none"
            style={{ fontFamily: "var(--font-display), sans-serif", color: z.stroke, transition: "color 400ms ease", textShadow: `0 0 24px ${z.glow}` }}
          >
            {score === null ? "—.———" : displayed.toFixed(3)}
          </span>
          <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-muted">
            divergence
          </span>
          <span
            className="chip mt-2.5"
            style={{
              color: score === null ? "var(--muted)" : z.stroke,
              borderColor: score === null ? "var(--glass-border)" : z.stroke,
              background: score === null ? "transparent" : `color-mix(in oklch, ${z.stroke} 12%, transparent)`,
              transition: "all 400ms ease",
            }}
          >
            {score === null ? "AWAITING SIGNAL" : z.label}
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-6 font-mono text-[11px]">
        <Stat label="threshold" value={threshold === null ? "—" : effThreshold.toFixed(2)} color="var(--halt)" />
        <Stat label="risk" value={riskLevel ?? "—"} />
        <Stat
          label="gate"
          value={decision ?? "—"}
          color={decision === "HALT" ? "var(--halt)" : decision === "ALLOW" ? "var(--allow)" : undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="text-muted">
      {label} <span className="tnum ml-0.5 font-semibold" style={{ color: color ?? "var(--foreground)" }}>{value}</span>
    </span>
  );
}
