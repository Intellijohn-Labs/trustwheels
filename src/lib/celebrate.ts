/*
 * A short confetti burst for milestones (vehicle saved, booked, sold, delivered).
 * Canvas-only, no dependencies; uses the current accent colours; skipped for reduced motion.
 */

type Piece = { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; shape: 0 | 1 };

export function celebrate(origin?: { x: number; y: number }) {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const css = getComputedStyle(document.documentElement);
  const colors = [css.getPropertyValue("--brand"), css.getPropertyValue("--brand-2"), "#facc15", "#34d399", "#f472b6"].map((c) => c.trim()).filter(Boolean);

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "70" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight * 0.35;
  const pieces: Piece[] = Array.from({ length: 140 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      shape: Math.random() > 0.5 ? 1 : 0,
    };
  });

  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vy += 0.28;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 1900);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < 1900) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
