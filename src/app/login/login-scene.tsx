import styles from "./login.module.css";

/** Decorative animated road scene. Purely visual, hidden from assistive tech. */
export function LoginScene({ leaving, className }: { leaving: boolean; className?: string }) {
  return (
    <div className={`${styles.scene} ${className ?? ""}`} aria-hidden>
      <div className={styles.sun} />

      <div className={`${styles.layer} ${styles.clouds}`}>
        <Clouds />
        <Clouds />
      </div>
      <div className={`${styles.layer} ${styles.hillsFar}`}>
        <Hills d="M0 150V92C120 60 220 40 340 70S560 40 700 62 960 48 1080 76 1200 92 1200 92V150Z" fill="var(--hill-far)" />
        <Hills d="M0 150V92C120 60 220 40 340 70S560 40 700 62 960 48 1080 76 1200 92 1200 92V150Z" fill="var(--hill-far)" />
      </div>
      <div className={`${styles.layer} ${styles.hillsNear}`}>
        <Hills d="M0 150V118C160 90 260 96 400 110S640 84 780 104 1040 92 1200 118V150Z" fill="var(--hill-near)" />
        <Hills d="M0 150V118C160 90 260 96 400 110S640 84 780 104 1040 92 1200 118V150Z" fill="var(--hill-near)" />
      </div>
      <div className={`${styles.layer} ${styles.palms}`}>
        <Palms />
        <Palms />
      </div>

      <div className={styles.road}>
        <div className={styles.lane} />
      </div>

      <div className={`${styles.bikeTrack} ${leaving ? styles.rideOff : ""}`}>
        <div className={styles.bob}>
          <Rider />
        </div>
      </div>
    </div>
  );
}

function Hills({ d, fill }: { d: string; fill: string }) {
  return (
    <svg viewBox="0 0 1200 150" height="150" preserveAspectRatio="none">
      <path d={d} fill={fill} />
    </svg>
  );
}

function Clouds() {
  const cloud = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="var(--cloud)">
      <ellipse cx="40" cy="22" rx="40" ry="14" />
      <ellipse cx="28" cy="14" rx="18" ry="14" />
      <ellipse cx="54" cy="10" rx="22" ry="16" />
    </g>
  );
  return (
    <svg viewBox="0 0 1200 120" height="120">
      {cloud(60, 20, 1)}
      {cloud(420, 60, 0.7)}
      {cloud(760, 10, 1.2)}
      {cloud(1050, 70, 0.6)}
    </svg>
  );
}

function Palms() {
  const palm = (x: number, h: number, lean: number) => {
    const top = 160 - h;
    const tx = x + lean;
    return (
      <g key={x} stroke="var(--palm)" fill="none" strokeLinecap="round">
        <path d={`M${x} 160 Q${x + lean * 0.2} ${top + h * 0.5} ${tx} ${top}`} strokeWidth="6" />
        {[
          [-46, 10],
          [-34, -12],
          [-6, -22],
          [26, -14],
          [44, 8],
          [14, 16],
        ].map(([dx, dy], i) => (
          <path key={i} d={`M${tx} ${top} Q${tx + dx * 0.5} ${top + dy - 16} ${tx + dx} ${top + dy + 10}`} strokeWidth="5" />
        ))}
      </g>
    );
  };
  return (
    <svg viewBox="0 0 1200 160" height="160" width="1200">
      {palm(120, 118, 14)}
      {palm(190, 86, -10)}
      {palm(560, 130, 18)}
      {palm(900, 104, -14)}
      {palm(960, 72, 10)}
      <g fill="var(--palm)">
        <ellipse cx="330" cy="158" rx="36" ry="12" />
        <ellipse cx="740" cy="158" rx="28" ry="10" />
        <ellipse cx="1110" cy="158" rx="40" ry="12" />
      </g>
    </svg>
  );
}

function Wheel({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy="100" r="24" fill="#10151c" />
      <circle cx={cx} cy="100" r="15" fill="#c9d1dc" />
      <g className={styles.wheel}>
        <circle cx={cx} cy="100" r="15" fill="none" />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={cx - 14} y1="100" x2={cx + 14} y2="100" stroke="#6b7685" strokeWidth="2.5" transform={`rotate(${a} ${cx} 100)`} />
        ))}
      </g>
      <circle cx={cx} cy="100" r="4" fill="#10151c" />
    </g>
  );
}

function Rider() {
  return (
    <svg viewBox="-60 0 290 132" className="block w-full overflow-visible">
      <defs>
        <linearGradient id="tw-beam" x1="0" x2="1">
          <stop offset="0" stopColor="#fff6c9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* speed lines */}
      <g stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round">
        <line className={styles.speed} x1="-40" y1="44" x2="-6" y2="44" />
        <line className={styles.speed} x1="-54" y1="62" x2="-14" y2="62" />
        <line className={styles.speed} x1="-34" y1="80" x2="-2" y2="80" />
      </g>

      {/* exhaust */}
      <g fill="rgba(235,240,248,0.9)">
        <circle className={styles.puff} cx="30" cy="104" r="6" />
        <circle className={styles.puff} cx="30" cy="104" r="6" />
        <circle className={styles.puff} cx="30" cy="104" r="6" />
      </g>

      <polygon className={styles.beam} points="186,60 240,40 240,96" fill="url(#tw-beam)" />

      <Wheel cx={52} />
      <Wheel cx={172} />

      {/* frame */}
      <path d="M52 100 L104 90" stroke="#3a4453" strokeWidth="6" strokeLinecap="round" />
      <path d="M34 104 L96 96" stroke="#9aa5b4" strokeWidth="5" strokeLinecap="round" />
      <path d="M28 86 Q48 64 80 72" stroke="#10151c" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="96" y="80" width="30" height="18" rx="4" fill="#4a5566" />
      <path d="M78 72 L124 62 Q146 58 154 70 L132 86 L98 90 Z" fill="#e5392f" />
      <path d="M100 70 Q118 60 138 64" stroke="#ff8a7a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M72 68 Q92 58 114 62 L110 70 L76 74 Z" fill="#10151c" />
      <path d="M152 56 L172 100" stroke="#9aa5b4" strokeWidth="6" strokeLinecap="round" />
      <path d="M144 52 L160 49" stroke="#10151c" strokeWidth="5" strokeLinecap="round" />
      <circle cx="164" cy="64" r="7" fill="#fff3b0" stroke="#10151c" strokeWidth="2" />
      <path d="M150 84 Q172 72 196 88" stroke="#10151c" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* rider */}
      <path d="M96 64 L120 82 L114 96" stroke="#1f2a44" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M92 62 Q104 40 124 34" style={{ stroke: "var(--brand)" }} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M122 38 L146 52" style={{ stroke: "var(--brand)" }} strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx="134" cy="22" r="13" fill="#f7f9fc" stroke="#10151c" strokeWidth="2" />
      <path d="M136 18 Q148 18 147 28 L136 28 Z" fill="#10151c" />
      <path d="M121 20 Q128 8 142 12" stroke="#e5392f" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
