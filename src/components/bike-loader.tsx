/**
 * A small motorcycle that "rides" in place - pure CSS keyframes (see globals.css's "bike loader"
 * section), no animation library. Reduced motion is handled by the app's existing global rule
 * that zeroes every animation's duration/iteration count, which freezes this into a clean static
 * bike (the wheel ends up back at its start rotation, the body at rest) with no extra code needed
 * here.
 */
export function BikeLoader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Signing in">
      <line className="bike-road" x1="4" y1="104" x2="196" y2="104" />

      <circle className="bike-puff bike-puff-1" cx="28" cy="80" r="4" />
      <circle className="bike-puff bike-puff-2" cx="22" cy="84" r="3" />
      <circle className="bike-puff bike-puff-3" cx="16" cy="88" r="2.5" />

      <g className="bike-unit">
        {/* rear wheel */}
        <g className="bike-wheel" style={{ transformOrigin: "48px 82px" }}>
          <circle cx="48" cy="82" r="14" className="bike-wheel-tire" />
          <circle cx="48" cy="82" r="4" className="bike-wheel-hub" />
          <line x1="48" y1="70" x2="48" y2="94" className="bike-spoke" />
          <line x1="36" y1="82" x2="60" y2="82" className="bike-spoke" />
          <line x1="39.5" y1="73.5" x2="56.5" y2="90.5" className="bike-spoke" />
          <line x1="56.5" y1="73.5" x2="39.5" y2="90.5" className="bike-spoke" />
        </g>

        {/* front wheel */}
        <g className="bike-wheel" style={{ transformOrigin: "146px 82px" }}>
          <circle cx="146" cy="82" r="14" className="bike-wheel-tire" />
          <circle cx="146" cy="82" r="4" className="bike-wheel-hub" />
          <line x1="146" y1="70" x2="146" y2="94" className="bike-spoke" />
          <line x1="134" y1="82" x2="158" y2="82" className="bike-spoke" />
          <line x1="137.5" y1="73.5" x2="154.5" y2="90.5" className="bike-spoke" />
          <line x1="154.5" y1="73.5" x2="137.5" y2="90.5" className="bike-spoke" />
        </g>

        {/* swingarm + front fork */}
        <line x1="48" y1="82" x2="84" y2="66" className="bike-frame" />
        <line x1="146" y1="82" x2="122" y2="52" className="bike-frame" />

        {/* tank / seat */}
        <rect x="64" y="56" width="60" height="16" rx="8" className="bike-body" />
        {/* seat tail */}
        <path d="M64 64 L52 70 L58 72 L66 68 Z" className="bike-body" />

        {/* windscreen */}
        <path d="M118 54 L129 42 L133 50 L122 60 Z" className="bike-screen" />

        {/* handlebar */}
        <line x1="122" y1="52" x2="112" y2="45" className="bike-frame" />

        {/* headlight */}
        <circle cx="131" cy="57" r="3.5" className="bike-headlight" />
      </g>
    </svg>
  );
}
