import type { CSSProperties } from "react";
import { LOGO_PATHS, LOGO_VIEWBOX, MARK_VIEWBOX } from "./logo-paths";
import { cn } from "./ui";

/*
 * Trust Wheels logo as inline SVG so it recolours for dark mode and each part can animate:
 * tyre tread, inner ring, red swoosh, banner, TRUST, W and HEELS are separate shapes.
 *   variant "full": the whole lockup; "mark": just the wheel with the W (square spaces, favicon).
 *   motion  "intro": plays the build-up animation once; "hover": tyre spins on hover; "none".
 */
export function Logo({
  variant = "full",
  motion = "hover",
  className,
  title = "Trust Wheels",
}: {
  variant?: "full" | "mark";
  motion?: "intro" | "hover" | "none";
  className?: string;
  title?: string;
}) {
  const full = variant === "full";
  const i = (n: number) => ({ "--i": n }) as CSSProperties;
  return (
    <svg
      viewBox={full ? LOGO_VIEWBOX : MARK_VIEWBOX}
      role="img"
      aria-label={title}
      className={cn("tw-logo block", motion === "intro" && "logo-intro", motion === "hover" && "logo-hover", className)}
    >
      <title>{title}</title>
      {full && <path className="tw-banner logo-ink" d={LOGO_PATHS.banner[0]} />}
      <path className="tw-tread logo-ink" d={LOGO_PATHS.tread[0]} />
      <path className="tw-ring logo-ink" d={LOGO_PATHS.ring[0]} />
      <path className="tw-swoosh logo-red" d={LOGO_PATHS.swoosh[0]} />
      {full && (
        <g className="logo-paper">
          {LOGO_PATHS.trust.map((d, n) => (
            <path key={n} className="tw-trust" style={i(n)} d={d} />
          ))}
        </g>
      )}
      <path className="tw-w logo-red" d={LOGO_PATHS.w[0]} />
      {full && (
        <g className="logo-ink">
          {LOGO_PATHS.heels.map((d, n) => (
            <path key={n} className="tw-heels" style={i(n)} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}
