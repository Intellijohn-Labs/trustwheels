/**
 * The sign-out overlay's motorcycle: idles with a brief shake and exhaust puffs, then accelerates
 * off the right edge of the screen. One-shot (see globals.css's "logout drive-away" section for
 * the keyframes) - not the looping ride-in-place animation the login screen used to show.
 */
export function LogoutDriveAway({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Signing out">
      {/* dust kicked up from the starting spot */}
      <rect x="-46" y="76" width="50" height="4" rx="2" className="logout-trail logout-trail-1" />
      <rect x="-34" y="86" width="40" height="3" rx="1.5" className="logout-trail logout-trail-2" />
      <rect x="-22" y="94" width="30" height="3" rx="1.5" className="logout-trail logout-trail-3" />

      <circle className="logout-puff logout-puff-1" cx="28" cy="80" r="4" />
      <circle className="logout-puff logout-puff-2" cx="20" cy="84" r="3" />

      <g className="logout-bike-unit">
        {/* rear wheel */}
        <g className="logout-bike-wheel" style={{ transformOrigin: "48px 82px" }}>
          <circle cx="48" cy="82" r="14" className="logout-bike-wheel-tire" />
          <circle cx="48" cy="82" r="4" className="logout-bike-wheel-hub" />
          <line x1="48" y1="70" x2="48" y2="94" className="logout-bike-spoke" />
          <line x1="36" y1="82" x2="60" y2="82" className="logout-bike-spoke" />
          <line x1="39.5" y1="73.5" x2="56.5" y2="90.5" className="logout-bike-spoke" />
          <line x1="56.5" y1="73.5" x2="39.5" y2="90.5" className="logout-bike-spoke" />
        </g>

        {/* front wheel */}
        <g className="logout-bike-wheel" style={{ transformOrigin: "146px 82px" }}>
          <circle cx="146" cy="82" r="14" className="logout-bike-wheel-tire" />
          <circle cx="146" cy="82" r="4" className="logout-bike-wheel-hub" />
          <line x1="146" y1="70" x2="146" y2="94" className="logout-bike-spoke" />
          <line x1="134" y1="82" x2="158" y2="82" className="logout-bike-spoke" />
          <line x1="137.5" y1="73.5" x2="154.5" y2="90.5" className="logout-bike-spoke" />
          <line x1="154.5" y1="73.5" x2="137.5" y2="90.5" className="logout-bike-spoke" />
        </g>

        {/* swingarm + front fork */}
        <line x1="48" y1="82" x2="84" y2="66" className="logout-bike-frame" />
        <line x1="146" y1="82" x2="122" y2="52" className="logout-bike-frame" />

        {/* tank / seat */}
        <rect x="64" y="56" width="60" height="16" rx="8" className="logout-bike-body" />
        {/* seat tail */}
        <path d="M64 64 L52 70 L58 72 L66 68 Z" className="logout-bike-body" />

        {/* windscreen */}
        <path d="M118 54 L129 42 L133 50 L122 60 Z" className="logout-bike-screen" />

        {/* handlebar */}
        <line x1="122" y1="52" x2="112" y2="45" className="logout-bike-frame" />

        {/* headlight */}
        <circle cx="131" cy="57" r="3.5" className="logout-bike-headlight" />
      </g>
    </svg>
  );
}
