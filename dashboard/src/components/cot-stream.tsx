"use client";

import { useEffect, useRef, useState } from "react";
import { PanelHeader } from "@/components/panel";
import { Icons } from "@/components/icons";

interface CotStreamProps {
  cot: string | null;
  tokenEstimate?: number;
  toolCallCount?: number;
  charsPerTick?: number;
}

/**
 * Live Chain-of-Thought token stream. Reveals the target model's reasoning
 * with a typewriter effect so the operator watches the monologue "arrive".
 */
export function CotStream({ cot, tokenEstimate, toolCallCount, charsPerTick = 3 }: CotStreamProps) {
  const [revealed, setRevealed] = useState("");
  const rafRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentCotRef = useRef<string | null>(null);

  useEffect(() => {
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
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (i < cot.length) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cot, charsPerTick]);

  const typing = cot !== null && revealed.length < cot.length;
  const shownTokens = cot ? Math.round((tokenEstimate ?? cot.length / 4) * (revealed.length / cot.length)) : 0;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        icon={<Icons.brain size={15} />}
        title="Chain-of-Thought Intercept"
        right={
          <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
            {typing && (
              <span className="flex items-center gap-1.5 text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent live-dot" style={{ color: "var(--accent)" }} />
                capturing
              </span>
            )}
            {cot !== null && (
              <span className="tnum">
                {shownTokens}
                {typing && `/${tokenEstimate ?? Math.round(cot.length / 4)}`} tok
                {typeof toolCallCount === "number" && <span className="text-accent"> · {toolCallCount} call(s)</span>}
              </span>
            )}
          </span>
        }
      />

      <div
        ref={scrollRef}
        className="scroll-thin flex-1 overflow-auto px-5 py-4"
        style={{ fontFamily: "var(--font-code), ui-monospace, monospace" }}
      >
        {cot === null ? (
          <p className="flex h-full items-center justify-center text-center text-sm italic text-muted-strong">
            The intercepted model&apos;s internal monologue streams here as it is captured.
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed tracking-tight text-foreground/90">
            <span className="select-none text-accent/70">▏</span> {revealed}
            {typing && <span className="cot-caret align-middle" />}
          </p>
        )}
      </div>
    </div>
  );
}
