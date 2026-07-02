import type { ReactNode } from "react";

interface PanelHeaderProps {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
  /** Tint the icon chip for a verdict/analysis context. */
  tone?: "accent" | "violet" | "halt" | "allow";
}

const TONE_STYLE: Record<NonNullable<PanelHeaderProps["tone"]>, { color: string; bg: string; border: string }> = {
  accent: { color: "var(--accent)", bg: "oklch(82% 0.14 200 / 0.1)", border: "oklch(82% 0.14 200 / 0.2)" },
  violet: { color: "var(--violet)", bg: "oklch(74% 0.15 292 / 0.1)", border: "oklch(74% 0.15 292 / 0.2)" },
  halt: { color: "var(--halt)", bg: "oklch(69% 0.2 18 / 0.1)", border: "oklch(69% 0.2 18 / 0.22)" },
  allow: { color: "var(--allow)", bg: "oklch(80% 0.16 162 / 0.1)", border: "oklch(80% 0.16 162 / 0.2)" },
};

export function PanelHeader({ icon, title, right, tone = "accent" }: PanelHeaderProps) {
  const t = TONE_STYLE[tone];
  return (
    <div className="panel-head">
      <span
        className="panel-head__icon"
        style={{ color: t.color, background: t.bg, borderColor: t.border }}
      >
        {icon}
      </span>
      <h2 className="panel-title">{title}</h2>
      {right != null && <div className="ml-auto flex items-center gap-3">{right}</div>}
    </div>
  );
}
