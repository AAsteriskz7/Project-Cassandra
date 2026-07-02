"use client";

import { useEffect, useRef, useState } from "react";

interface CotStreamProps {
  /** Full reasoning text from the cot_captured event, or null before capture. */
  cot: string | null;
  /** Approx token count, if the backend supplied it. */
  tokenEstimate?: number;
  toolCallCount?: number;
  /** Characters revealed per animation frame (~60fps). */
  charsPerTick?: number;
}

/**
 * Live Chain-of-Thought token stream. Reveals the target model's reasoning
 * with a typewriter effect so the operator watches the monologue "arrive".
 */
export function CotStream({
  cot,
  tokenEstimate,
  toolCallCount,
  charsPerTick = 3,
}: CotStreamProps) {
  const [revealed, setRevealed] = useState("");
  const rafRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentCotRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset and re-type whenever a new CoT arrives.
    if (cot === currentCotRef.current) return;
    currentCotRef.current = cot;
    cancelAnimationFrame(rafRef.current);

    if (!cot) {
      setRevealed("");
      return;
    }

    let i = 0;
    const step = () => {
      i = Math.min(i + charsPerTick, cot.length);
      setRevealed(cot.slice(0, i));
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      if (i < cot.length) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
  }, [cot, charsPerTick]);

  const typing = cot !== null && revealed.length < cot.length;
  const shownTokens = cot ? Math.round((tokenEstimate ?? cot.length / 4) * (revealed.length / cot.length)) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-glass-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              typing ? "bg-accent shadow-[0_0_6px_var(--accent-glow)] animate-pulse" : "bg-[var(--muted-strong)]"
            }`}
          />
          Chain-of-Thought Stream
        </h2>
        <span className="font-mono text-[11px] text-muted">
          {cot === null ? (
            "awaiting capture"
          ) : (
            <>
              ~{shownTokens}
              {typing && <>/{tokenEstimate ?? Math.round(cot.length / 4)}</>} tokens
              {typeof toolCallCount === "number" && (
                <span className="text-accent"> · {toolCallCount} tool call(s)</span>
              )}
            </>
          )}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="scroll-thin flex-1 overflow-auto px-5 py-4"
        style={{ fontFamily: "var(--font-code), ui-monospace, monospace" }}
      >
        {cot === null ? (
          <p className="text-sm italic text-muted">
            The intercepted model&apos;s internal monologue will stream here as it is captured…
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed tracking-tight text-foreground/90">
            <span className="select-none text-[var(--muted-strong)]">&gt; </span>
            {revealed}
            {typing && <span className="cot-caret align-middle" />}
          </p>
        )}
      </div>
    </div>
  );
}
