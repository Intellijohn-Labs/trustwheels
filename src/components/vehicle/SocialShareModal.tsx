"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, ExternalLink, Loader2, RefreshCw, Send, Share2 } from "lucide-react";
import { useToast } from "../toast";
import { branchName, PHOTO_SLOTS } from "@/lib/masters";
import { currentBranchId } from "@/lib/workflow";
import { displayReg, formatNumber, formatPaise } from "@/lib/format";
import { fetchSocialStatus, publishToSocial, type PlatformResult, type PublishResponse, type SocialPlatform } from "@/lib/social-publish";
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

const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", facebook: "Facebook" };

/** One line per platform from the publish workflow, with whatever follow-up action its result allows. */
function ResultRow({
  platform,
  r,
  busy,
  onRetry,
  onCheck,
  onManual,
}: {
  platform: SocialPlatform;
  r: PlatformResult;
  busy: boolean;
  onRetry: () => void;
  onCheck: () => void;
  onManual: () => void;
}) {
  const name = PLATFORM_LABEL[platform];
  const tone =
    r.status === "success" ? "ok" : r.status === "processing" || r.status === "not_posted" || r.status === "already_posted" ? "warn" : "bad";
  const action = r.action ?? "";
  const canRetry = r.status === "failed" ? !!r.retryable : r.status === "not_posted" && action === "post_single";
  const canManual = r.status === "failed" && action.includes("post_manually");
  const canCheck = r.status === "processing" || action === "check_status";
  const wait = r.retryAfterSeconds ? ` (about ${Math.ceil(r.retryAfterSeconds / 60)} min)` : "";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? Clock : AlertTriangle;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl p-3 text-sm",
        tone === "ok" && "bg-ok-soft/60 text-ok",
        tone === "warn" && "bg-warn-soft/60 text-warn",
        tone === "bad" && "bg-danger-soft/60 text-danger",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {name}
          {r.status === "success" && " - posted"}
          {r.status === "processing" && " - publishing"}
          {r.status === "already_posted" && " - already posted"}
          {r.status === "not_posted" && " - not posted yet"}
          {r.status === "failed" && " - failed"}
        </p>
        {r.message && (
          <p className="mt-0.5 break-words">
            {r.message}
            {r.status === "failed" && r.code === "RATE_LIMITED" ? wait : ""}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {r.status === "success" && r.postUrl && (
            <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline">
              View post <ExternalLink className="size-3.5" />
            </a>
          )}
          {canCheck && (
            <Button size="sm" type="button" onClick={onCheck} disabled={busy}>
              <RefreshCw className="size-3.5" /> Check status
            </Button>
          )}
          {canRetry && (
            <Button size="sm" type="button" onClick={onRetry} disabled={busy}>
              {r.status === "not_posted" ? `Post to ${name} only` : "Try again"}
            </Button>
          )}
          {canManual && (
            <Button size="sm" type="button" onClick={onManual} disabled={busy}>
              <Copy className="size-3.5" /> Copy caption &amp; open {name}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Publish a Ready for Sale vehicle to Instagram / Facebook through the Social Publish n8n workflow
 * (via /api/social/*). The workflow checks the vehicle, photos and connected accounts, and replies
 * per platform; those replies are shown here as-is, with a manual "copy caption & open" fallback.
 */
export function SocialShareModal({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const toast = useToast();
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [caption, setCaption] = useState(() => defaultCaption(v));
  const slots = PHOTO_SLOTS.filter((p) => v.photos[p.slot]);
  const [selected, setSelected] = useState<Set<PhotoSlot>>(() => new Set(slots.map((p) => p.slot)));
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<PublishResponse | null>(null);

  const targets: SocialPlatform[] = platform === "both" ? ["instagram", "facebook"] : [platform];

  function toggle(slot: PhotoSlot) {
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(slot)) next.add(slot);
      return next;
    });
  }

  async function publish(platforms: SocialPlatform[] = targets) {
    if (busy) return;
    setBusy(true);
    setResponse(null);
    const res = await publishToSocial({
      vehicleId: v.id,
      caption,
      platforms,
      imageKeys: slots.map((p) => p.slot).filter((k) => selected.has(k)),
    });
    setResponse(res);
    setBusy(false);
    if (res.ok && !res.processing) toast("ok", "Posted successfully");
  }

  async function checkStatus() {
    if (busy) return;
    setBusy(true);
    const res = await fetchSocialStatus(v.id);
    // Keep the rows already on screen for platforms the status call doesn't know about.
    setResponse((prev) => (res.ok ? { ...res, results: { ...prev?.results, ...res.results } } : res));
    setBusy(false);
  }

  async function postManually(p: SocialPlatform) {
    try {
      await navigator.clipboard.writeText(caption);
      toast("ok", "Caption copied - paste it into your post");
    } catch {
      toast("error", "Couldn't copy the caption automatically - select and copy it manually");
    }
    window.open(PLATFORM_URL[p], "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog
      wide
      title="Share to Social Media"
      subtitle={`${v.make} ${v.model} · ${displayReg(v.registrationNo)}`}
      onClose={onClose}
      onSubmit={() => publish()}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            {response ? "Close" : "Cancel"}
          </Button>
          <button
            type="submit"
            disabled={busy || !caption.trim() || selected.size === 0}
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
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {busy ? "Publishing…" : "Publish"}
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
              disabled={busy}
              onClick={() => setPlatform(p.id)}
              className={cn(
                "relative inline-flex select-none items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-60",
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
            disabled={busy}
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

        {(response || busy) && (
          <div aria-live="polite">
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> Checking and publishing - this can take up to a minute. Please keep this window open.
              </p>
            )}
            {response?.results && (
              <ul className="space-y-2">
                {(["instagram", "facebook"] as const).map((p) => {
                  const r = response.results?.[p];
                  return r ? (
                    <ResultRow key={p} platform={p} r={r} busy={busy} onRetry={() => publish([p])} onCheck={checkStatus} onManual={() => postManually(p)} />
                  ) : null;
                })}
              </ul>
            )}
            {response && !response.results && (
              <div className="flex items-start gap-3 rounded-2xl bg-danger-soft/60 p-3 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{response.message ?? "Something went wrong. Try again in a minute."}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {response.action === "check_status" && (
                      <Button size="sm" type="button" onClick={checkStatus} disabled={busy}>
                        <RefreshCw className="size-3.5" /> Check status
                      </Button>
                    )}
                    {response.retryable && response.action !== "check_status" && (
                      <Button size="sm" type="button" onClick={() => publish()} disabled={busy}>
                        Try again
                      </Button>
                    )}
                    {response.action?.includes("post_manually") &&
                      targets.map((p) => (
                        <Button key={p} size="sm" type="button" onClick={() => postManually(p)} disabled={busy}>
                          <Copy className="size-3.5" /> Copy caption &amp; open {PLATFORM_LABEL[p]}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
