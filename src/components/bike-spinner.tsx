/**
 * Compact inline loading icon for the login button (replaces the generic spinner while
 * authenticating / getting location): a minimal motorcycle silhouette, wheels spinning, a couple
 * of warm motion-trail dashes behind it. Sized to sit inline with button text, same footprint as
 * the Loader2 icon it replaces - purely decorative, respects prefers-reduced-motion globally
 * (see globals.css's blanket animation: none rule).
 */
export function BikeSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" className={className} fill="none" aria-hidden>
      {/* motion trails - warm amber, matching the login scene's horizon */}
      <g stroke="#ffb74d" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
        <line className="animate-pulse" x1="0" y1="7" x2="6" y2="7" />
        <line className="animate-pulse" style={{ animationDelay: "0.15s" }} x1="1.5" y1="11" x2="7.5" y2="11" />
      </g>
      {/* frame */}
      <path d="M9 14 L15 9.5 M9 14 L19 12.5 M15 9.5 L18 7.5 L21 9 L19 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 7.5 L16.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="21" cy="9" r="1.3" fill="currentColor" />
      {/* wheels, spinning */}
      <g style={{ transformBox: "fill-box", transformOrigin: "center" }} className="animate-spin">
        <circle cx="9" cy="14" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 11v6M6 14h6M7 12l4 4M11 12l-4 4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      </g>
      <g style={{ transformBox: "fill-box", transformOrigin: "center" }} className="animate-spin">
        <circle cx="23" cy="14" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M23 11v6M20 14h6M21 12l4 4M25 12l-4 4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      </g>
    </svg>
  );
}
