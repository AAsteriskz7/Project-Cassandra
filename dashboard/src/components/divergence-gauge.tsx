"use client";

import { useEffect, useRef, useState } from "react";
import type { GateVerdict } from "@/lib/types";

interface DivergenceGaugeProps {
  /** Composite divergence score 0..1, or null before divergence_scored arrives. */
  score: number | null;
  /** Effective HALT threshold from gate_decision; null until known. */
  threshold: number | null;
  decision: GateVerdict | null;
  riskLevel?: string | null;
}

/** Fallback while the Gatekeeper hasn't reported the effective threshold yet. */
const DEFAULT_THRESHOLD = 0.6;
const ANIM_MS = 900;

/** Gauge geometry: a 270° arc opening at the bottom. */
const R = 84;
const CIRCUMFERENCE = 2 * Math.PI * R;
const ARC_FRACTION = 0.75;
const ARC_LEN = CIRCUMFERENCE * ARC_FRACTION;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function zoneColor(value: number, threshold: number, decision: GateVerdict | null) {
  if (decision === "HALT" || value >= threshold) {
    return { stroke: "var(--halt)", glow: "var(--halt-glow)", label: "CRITICAL" };
  }
  if (value >= threshold * 0.75) {
    return { stroke: "var(--warn)", glow: "var(--warn-glow)", label: "ELEVATED" };
  }
  return { stroke: "var(--allow)", glow: "var(--allow-glow)", label: "NOMINAL" };
}

export function DivergenceGauge({ score, threshold, decision, riskLevel }: DivergenceGaugeProps) {
  // Animated value chases the target score with an ease-out tween.
  const [displayed, setDisplayed] = useState(0);
  const animRef = useRef<number>(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = score ?? 0;
    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / ANIM_MS, 1);
      const value = from + (target - from) * easeOutCubic(t);
      setDisplayed(value);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  const effectiveThreshold = threshold ?? DEFAULT_THRESHOLD;
  const zone = zoneColor(displayed, effectiveThreshold, score !== null ? decision : null);
  const clamped = Math.max(0, Math.min(displayed, 1));

  // Rotate so the 270° arc is symmetric about the top (gap at the bottom).
  const rotation = 90 + (360 * (1 - ARC_FRACTION)) / 2;
  // Threshold tick angle along the arc.
  const thresholdAngle = rotation + 360 * ARC_FRACTION * Math.min(effectiveThreshold, 1);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="220" height="220" viewBox="0 0 220 220">
          {/* Track */}
          <circle
            cx="110" cy="110" r={R}
            fill="none"
            stroke="var(--glass-border)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE}`}
            transform={`rotate(${rotation} 110 110)`}
          />
          {/* Value arc — dasharray length follows the animated score */}
          <circle
            cx="110" cy="110" r={R}
            fill="none"
            stroke={zone.stroke}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LEN * clamped} ${CIRCUMFERENCE}`}
            transform={`rotate(${rotation} 110 110)`}
            style={{
              filter: `drop-shadow(0 0 8px ${zone.glow})`,
              transition: "stroke 400ms ease",
            }}
          />
          {/* Threshold tick */}
          <line
            x1="110" y1={110 - R - 10}
            x2="110" y2={110 - R + 10}
            stroke="var(--halt)"
            strokeWidth="2.5"
            opacity={threshold !== null ? 0.9 : 0.35}
            transform={`rotate(${thresholdAngle + 90} 110 110)`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-4xl font-semibold tabular-nums"
            style={{ color: zone.stroke, transition: "color 400ms ease" }}
          >
            {score === null ? "—" : displayed.toFixed(3)}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">
            divergence
          </span>
          <span
            className="mt-2 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-widest"
            style={{
              color: score === null ? "var(--muted)" : zone.stroke,
              borderColor: score === null ? "var(--glass-border)" : zone.stroke,
              transition: "color 400ms ease, border-color 400ms ease",
            }}
          >
            {score === null ? "AWAITING" : zone.label}
          </span>
        </div>
      </div>
      <div className="mt-1 flex gap-5 font-mono text-[11px] text-muted">
        <span>
          threshold{" "}
          <span className="text-halt">
            {threshold === null ? "—" : effectiveThreshold.toFixed(2)}
          </span>
        </span>
        <span>
          risk <span className="text-foreground">{riskLevel ?? "—"}</span>
        </span>
        <span>
          gate{" "}
          <span className={decision === "HALT" ? "text-halt" : decision === "ALLOW" ? "text-allow" : "text-foreground"}>
            {decision ?? "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
