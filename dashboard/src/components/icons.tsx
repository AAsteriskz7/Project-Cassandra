/**
 * Inline SVG icon set (Lucide geometry, 24-grid, 1.75 stroke, currentColor).
 * No emoji anywhere in the UI — icons are tokenized and theme-aware.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, strokeWidth = 1.75, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

/** Cassandra brand mark — an all-seeing eye inside a scanning reticle. */
export function BrandMark({ size = 30, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" {...props}>
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <path d="M16 1.5V5M16 27v3.5M1.5 16H5M27 16h3.5" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M4 16C6.5 10.5 10.7 8 16 8s9.5 2.5 12 8c-2.5 5.5-6.7 8-12 8S6.5 21.5 4 16Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}

export const Icons = {
  activity: (p: IconProps) => (
    <svg {...base(p)}><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
  ),
  brain: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 5a3 3 0 0 0-5.9-.7A2.5 2.5 0 0 0 4 8.5a2.5 2.5 0 0 0 .5 3.5A2.5 2.5 0 0 0 6 16a3 3 0 0 0 6 0V5Z" />
      <path d="M12 5a3 3 0 0 1 5.9-.7A2.5 2.5 0 0 1 20 8.5a2.5 2.5 0 0 1-.5 3.5A2.5 2.5 0 0 1 18 16a3 3 0 0 1-6 0" />
    </svg>
  ),
  split: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M6 3v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4" />
      <path d="m14 14 4 3-4 3M9 6 6 3 3 6" />
    </svg>
  ),
  gauge: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 14 15 9" />
      <path d="M4.5 18a9 9 0 1 1 15 0" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  terminal: (p: IconProps) => (
    <svg {...base(p)}><path d="m5 8 4 4-4 4M12 16h7" /><rect x="2" y="4" width="20" height="16" rx="2" /></svg>
  ),
  table: (p: IconProps) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>
  ),
  metrics: (p: IconProps) => (
    <svg {...base(p)}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
  ),
  play: (p: IconProps) => (
    <svg {...base(p)}><path d="M6 4.5v15l13-7.5-13-7.5Z" fill="currentColor" /></svg>
  ),
  trash: (p: IconProps) => (
    <svg {...base(p)}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /></svg>
  ),
  shield: (p: IconProps) => (
    <svg {...base(p)}><path d="M12 2.5 4.5 5.5v6c0 4.5 3 7.8 7.5 9.5 4.5-1.7 7.5-5 7.5-9.5v-6L12 2.5Z" /></svg>
  ),
  shieldAlert: (p: IconProps) => (
    <svg {...base(p)}><path d="M12 2.5 4.5 5.5v6c0 4.5 3 7.8 7.5 9.5 4.5-1.7 7.5-5 7.5-9.5v-6L12 2.5Z" /><path d="M12 8v4M12 15.5v.5" /></svg>
  ),
  check: (p: IconProps) => (
    <svg {...base(p)}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
  ),
  alert: (p: IconProps) => (
    <svg {...base(p)}><path d="M10.3 4 3 17a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 16.5v.5" /></svg>
  ),
  zap: (p: IconProps) => (
    <svg {...base(p)}><path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" /></svg>
  ),
  radar: (p: IconProps) => (
    <svg {...base(p)}><path d="M20 12a8 8 0 1 1-4.5-7.2" /><path d="M12 12 15.5 8.5M12 12l0-6" strokeWidth="1.4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
  ),
};
