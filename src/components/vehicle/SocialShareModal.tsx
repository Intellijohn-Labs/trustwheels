"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useToast } from "../toast";
import { branchName, PHOTO_SLOTS } from "@/lib/masters";
import { currentBranchId } from "@/lib/workflow";
import { displayReg, formatNumber, formatPaise } from "@/lib/format";
import type { PhotoSlot, Vehicle } from "@/lib/types";
import { Button, cn } from "../ui";
import { Dialog } from "../panels/dialog";

type Platform = "instagram" | "facebook" | "both";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.3 0-3.9 1.4-3.9 4v2.2H8V13.5h2.5V21h3z" />
    </svg>
  );
}

const PLATFORMS: { id: Platform; label: string; icon: ReactNode; gradient: string; glow: string }[] = [
  {
    id: "instagram",
    label: "Instagram",
    icon: <InstagramIcon className="size-4" />,
    gradient: "linear-gradient(135deg, #feda75 0%, #fa7e1e 25%, #d62976 55%, #962fbf 80%, #4f5bd5 100%)",
    glow: "rgba(214, 41, 118, 0.45)",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: <FacebookIcon className="size-4" />,
    gradient: "linear-gradient(135deg, #4aa3ff 0%, #1877f2 55%, #0c4fc2 100%)",
    glow: "rgba(24, 119, 242, 0.45)",
  },
  {
    id: "both",
    label: "Both (Instagram & Facebook)",
    icon: (
      <span className="flex -space-x-1">
        <InstagramIcon className="size-4" />
        <FacebookIcon className="size-4" />
      </span>
    ),
    gradient: "linear-gradient(135deg, #a78bfa 0%, #6366f1 55%, #3b3fc4 100%)",
    glow: "rgba(99, 102, 241, 0.45)",
  },
];

const PLATFORM_URL = { instagram: "https://www.instagram.com/", facebook: "https://www.facebook.com/" };

/** Default caption from the vehicle's own data. Transmission isn't recorded on a vehicle, so it's left out rather than guessed. */
function defaultCaption(v: Vehicle) {
  const price = v.proposedPricePaise ? formatPaise(v.proposedPricePaise) : "Contact for price";
  return [
    `🚗 ${v.make} ${v.model} (${v.year})`,
    `💰 Price: ${price}`,
    `📍 Available at: ${branchName(currentBranchId(v))}`,
    `⚡ Kilometers: ${formatNumber(v.odometerKm)} km | Fuel: ${v.fuel.charAt(0).toUpperCase()}${v.fuel.slice(1)}`,
    `📞 Contact TrustWheels for bookings & test drives!`,
  ].join("\n");
}

/**
 * Share a Ready for Sale vehicle to Instagram / Facebook. No Meta Graph API is configured, so
 * "Copy Caption & Open" copies the caption to the clipboard and opens the chosen platform(s) in a new tab.
 */
export function SocialShareModal({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const toast = useToast();
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [caption, setCaption] = useState(() => defaultCaption(v));
  const slots = PHOTO_SLOTS.filter((p) => v.photos[p.slot]);
  const [selected, setSelected] = useState<Set<PhotoSlot>>(() => new Set(slots.map((p) => p.slot)));

  function toggle(slot: PhotoSlot) {
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(slot)) next.add(slot);
      return next;
    });
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(caption);
      toast("ok", "Caption copied - paste it into your post");
    } catch {
      toast("error", "Couldn't copy the caption automatically - select and copy it manually");
    }
    const targets = platform === "both" ? (["instagram", "facebook"] as const) : ([platform] as const);
    targets.forEach((t) => window.open(PLATFORM_URL[t], "_blank", "noopener,noreferrer"));
    onClose();
  }

  return (
    <Dialog
      wide
      title="Share to Social Media"
      subtitle={`${v.make} ${v.model} · ${displayReg(v.registrationNo)}`}
      onClose={onClose}
      onSubmit={share}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={!caption.trim()}
            className="relative inline-flex flex-[2] cursor-pointer select-none items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide text-white transition-transform duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.95) 0%, rgba(37, 99, 235, 1) 100%)",
              boxShadow: "inset 0 2px 5px rgba(255, 255, 255, 0.85), inset 0 -3px 6px rgba(15, 23, 42, 0.45), 0 6px 18px -2px rgba(37, 99, 235, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.55)",
            }}
          >
            {/* Upper specular gloss highlight */}
            <span className="pointer-events-none absolute left-3 right-3 top-0.5 h-[45%] rounded-full bg-gradient-to-b from-white/80 to-transparent" />
            <span className="relative z-10 flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              <Copy className="size-4" /> Publish <ExternalLink className="size-4" />
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Platform" className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={platform === p.id}
              onClick={() => setPlatform(p.id)}
              className={cn(
                "relative inline-flex select-none items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95",
                platform === p.id ? "text-white hover:scale-105" : "border border-line bg-surface/60 text-muted backdrop-blur hover:border-accent hover:text-ink",
              )}
              style={
                platform === p.id
                  ? {
                      background: p.gradient,
                      border: "1px solid rgba(255, 255, 255, 0.4)",
                      boxShadow: `inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -2px 5px rgba(15,23,42,0.35), 0 6px 16px -2px ${p.glow}`,
                    }
                  : undefined
              }
            >
              {platform === p.id && (
                <span
                  className="pointer-events-none absolute left-2 right-2 top-0.5 h-1/2 rounded-full"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.05) 100%)" }}
                />
              )}
              <span className={cn("relative z-10 flex items-center gap-2", platform === p.id && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]")}>
                {p.icon}
                {p.label}
              </span>
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="social-caption" className="mb-1.5 block text-sm font-medium">
            Caption
          </label>
          <textarea
            id="social-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
            className="w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">
            Photos in the post <span className="font-normal text-muted">({selected.size} of {slots.length} selected)</span>
          </p>
          {slots.length === 0 ? (
            <p className="text-sm text-muted">No photos uploaded for this vehicle yet - use Edit photos first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map((p) => {
                const on = selected.has(p.slot);
                return (
                  <button
                    key={p.slot}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.slot)}
                    className={cn("relative overflow-hidden rounded-2xl border-2 transition", on ? "border-accent" : "border-line opacity-50")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.photos[p.slot]} alt={p.label} className="aspect-[4/3] w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left text-xs text-white">{p.label}</span>
                    {on && (
                      <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** Round icon-only trigger for the Ready for Sale rows; owns the modal's open state. */
export function SocialShareButton({ vehicle: v }: { vehicle: Vehicle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative inline-flex items-center justify-center">
        <style>{`
          @keyframes liquidWobble {
            0%, 100% { border-radius: 9999px; transform: scale(1); }
            33% { border-radius: 22px 26px 20px 24px / 24px 20px 26px 22px; transform: scale(1.02, 0.98); }
            66% { border-radius: 26px 21px 25px 20px / 21px 25px 22px 26px; transform: scale(0.98, 1.02); }
          }
          @keyframes innerFluidFlow {
            0% { transform: translateX(-40%) skewX(-15deg); }
            50% { transform: translateX(40%) skewX(15deg); }
            100% { transform: translateX(-40%) skewX(-15deg); }
          }
        `}</style>

        {/* Main 3D jelly capsule button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Share to Social Media"
          aria-label={`Share ${v.make} ${v.model} to social media`}
          className="relative inline-flex cursor-pointer select-none items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 transition-transform duration-200 hover:scale-105 active:scale-90"
          style={{
            animation: "liquidWobble 4s ease-in-out infinite",
            background: "linear-gradient(135deg, rgba(56, 189, 248, 0.92) 0%, rgba(37, 99, 235, 0.98) 100%)",
            boxShadow: `
              inset 0 3px 5px rgba(255, 255, 255, 0.85),
              inset 0 -3px 6px rgba(15, 23, 42, 0.45),
              0 6px 16px -2px rgba(37, 99, 235, 0.55)
            `,
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          {/* Inside moving liquid sheen */}
          <span
            className="pointer-events-none absolute inset-0 h-full w-[200%] opacity-40"
            style={{
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, transparent 70%)",
              animation: "innerFluidFlow 3.5s ease-in-out infinite",
            }}
          />
          {/* Upper glass specular highlight */}
          <span
            className="pointer-events-none absolute left-2 right-2 top-0.5 h-[42%] rounded-full"
            style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.08) 100%)" }}
          />
          <span className="relative z-10 flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            <Share2 className="h-3.5 w-3.5" />
          </span>
          <span className="relative z-10 text-xs font-semibold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">Share</span>
        </button>
      </div>
      {open && <SocialShareModal vehicle={v} onClose={() => setOpen(false)} />}
    </>
  );
}
