"use client";

import { useMemo } from "react";
import { PanelHeader } from "@/components/panel";
import { Icons } from "@/components/icons";
import type { DivergenceScoredPayload, PerturbationGeneratedPayload } from "@/lib/types";

interface PerturbationDiffProps {
  originalCot: string | null;
  perturbations: PerturbationGeneratedPayload | null;
  divergence: DivergenceScoredPayload | null;
}

const VARIANT_META: {
  key: keyof Pick<PerturbationGeneratedPayload, "counterfactual" | "constraint_relaxation" | "semantic_paraphrase">;
  label: string;
  hint: string;
}[] = [
  { key: "counterfactual", label: "Counterfactual", hint: "context flipped" },
  { key: "constraint_relaxation", label: "Constraint Relaxation", hint: "guardrails removed" },
  { key: "semantic_paraphrase", label: "Semantic Paraphrase", hint: "meaning preserved" },
];

/** Tokenize on whitespace, keeping the trailing spaces so we can re-join faithfully. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

/**
 * LCS token diff. Marks each variant token as "same" (part of the longest
 * common subsequence with the original) or "diverged" (newly introduced under
 * perturbation — i.e. where the reasoning path splits).
 */
function diffTokens(original: string, variant: string): { text: string; diverged: boolean }[] {
  const a = tokenize(original.toLowerCase());
  const bRaw = tokenize(variant);
  const b = bRaw.map((t) => t.toLowerCase());

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i].trim() === b[j].trim()
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: { text: string; diverged: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (j < m) {
    if (i < n && a[i].trim() === b[j].trim()) {
      out.push({ text: bRaw[j], diverged: false });
      i++;
      j++;
    } else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      out.push({ text: bRaw[j], diverged: true });
      j++;
    }
  }
  return out;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(value, 1)) * 100);
  const color = value >= 0.6 ? "var(--halt)" : value >= 0.4 ? "var(--warn)" : "var(--allow)";
  return (
    <div className="flex-1">
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span style={{ color }}>{value.toFixed(3)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-border)]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  );
}

export function PerturbationDiff({ originalCot, perturbations, divergence }: PerturbationDiffProps) {
  const diffs = useMemo(() => {
    if (!originalCot || !perturbations) return null;
    return VARIANT_META.map((meta) => ({
      ...meta,
      segments: diffTokens(originalCot, perturbations[meta.key]),
    }));
  }, [originalCot, perturbations]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        icon={<Icons.split size={15} />}
        title="Adversarial Perturbation Diff"
        tone="violet"
        right={
          divergence && (
            <span className="font-mono text-[11px] text-muted">
              composite{" "}
              <span className={`tnum font-semibold ${divergence.composite_score >= 0.4 ? "text-halt" : "text-allow"}`}>
                {divergence.composite_score.toFixed(3)}
              </span>
            </span>
          )
        }
      />

      {!diffs ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm italic text-muted">
            Awaiting Injector swarm — the three adversarial variants will map against the original here.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-auto p-5 scroll-thin">
          {/* Divergence dimensions from the Monitor */}
          {divergence && (
            <div className="glass flex gap-4 px-4 py-3">
              <ScoreBar label="Semantic" value={divergence.semantic_divergence} />
              <ScoreBar label="Structural" value={divergence.structural_divergence} />
              <ScoreBar label="Goal" value={divergence.goal_divergence} />
            </div>
          )}

          {/* Original CoT reference */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                Original
              </span>
              <span className="text-[11px] text-muted">baseline reasoning path</span>
            </div>
            <p
              className="rounded-lg border border-glass-border bg-[var(--glass-bg)] p-3 text-[12px] leading-relaxed text-foreground/80"
              style={{ fontFamily: "var(--font-code), monospace" }}
            >
              {originalCot}
            </p>
          </div>

          {/* Variant diffs */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {diffs.map((d) => {
              const divergedCount = d.segments.filter((s) => s.diverged).length;
              const total = d.segments.length || 1;
              const splitPct = Math.round((divergedCount / total) * 100);
              return (
                <div key={d.key} className="glass flex flex-col p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-accent">{d.label}</span>
                    <span className="font-mono text-[10px] text-muted">{d.hint}</span>
                  </div>
                  <p
                    className="flex-1 text-[12px] leading-relaxed text-foreground/60"
                    style={{ fontFamily: "var(--font-code), monospace" }}
                  >
                    {d.segments.map((seg, idx) =>
                      seg.diverged ? (
                        <span
                          key={idx}
                          className="rounded-sm text-foreground"
                          style={{
                            background: "rgba(251, 191, 36, 0.16)",
                            boxShadow: "inset 0 -1px 0 var(--warn)",
                          }}
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={idx}>{seg.text}</span>
                      )
                    )}
                  </p>
                  <div className="mt-2 flex items-center gap-2 border-t border-glass-border pt-2 font-mono text-[10px] text-muted">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: splitPct >= 40 ? "var(--halt)" : "var(--warn)" }}
                    />
                    {splitPct}% of tokens diverged from baseline
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monitor explanation */}
          {divergence?.explanation && (
            <div className="rounded-lg border border-glass-border bg-[var(--glass-bg)] p-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                Divergence Monitor — structural review
              </p>
              <p className="text-[12px] leading-relaxed text-foreground/75">{divergence.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
