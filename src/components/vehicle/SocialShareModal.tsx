"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, ExternalLink, Loader2, RefreshCw, Send, Share2 } from "lucide-react";
import { useToast } from "../toast";
import { PHOTO_SLOTS } from "@/lib/masters";
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

/** Brand look per selection: the tab, photo ring, Publish button, loader and result cards all draw from this. */
const PLATFORMS: { id: Platform; label: string; icon: ReactNode; gradient: string; glow: string; tabGlow: string; colors: [string, string] }[] = [
  {
    id: "instagram",
    label: "Instagram",
    icon: <InstagramIcon className="size-4" />,
    gradient: "linear-gradient(135deg, #f58529 0%, #dd2a7b 45%, #8134af 80%, #515bd4 100%)",
    glow: "rgba(221, 42, 123, 0.45)",
    tabGlow: "rgba(225, 48, 108, 0.35)",
    colors: ["#dd2a7b", "#8134af"],
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: <FacebookIcon className="size-4" />,
    gradient: "linear-gradient(135deg, #3b8bff 0%, #1877f2 55%, #0f5fd1 100%)",
    glow: "rgba(24, 119, 242, 0.45)",
    tabGlow: "rgba(24, 119, 242, 0.35)",
    colors: ["#3b8bff", "#1877f2"],
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
    gradient: "linear-gradient(100deg, #f58529 0%, #dd2a7b 28%, #8134af 48%, #1877f2 62%, #0f5fd1 100%)",
    glow: "rgba(129, 52, 175, 0.45)",
    tabGlow: "rgba(129, 52, 175, 0.35)",
    colors: ["#dd2a7b", "#1877f2"],
  },
];

const CAPTION_LIMIT = 2200;

const PLATFORM_URL = { instagram: "https://www.instagram.com/", facebook: "https://www.facebook.com/" };

/** Default caption from the vehicle's own data. Transmission isn't recorded on a vehicle, so it's left out rather than guessed. */
function defaultCaption(v: Vehicle) {
  const price = v.proposedPricePaise ? formatPaise(v.proposedPricePaise) : "Contact for price";
  return [
    `🛵 ${v.make} ${v.model} (${v.year})`,
    `💰 Price: ${price}`,
    `📍 Location: Opposite Yamaha Speed Motors, Near railway station, Aluva Road, Angamaly`,
    `⚡ Kilometers: ${formatNumber(v.odometerKm)} km | Fuel: ${v.fuel.charAt(0).toUpperCase()}${v.fuel.slice(1)}`,
    `📞 Contact / WhatsApp: 8086868727, 7559040398`,
  ].join("\n");
}

/** In-flight state: a thin ring and a softly pulsing core, tinted with the selected platform's colours. */
function PublishingLoader({ colors }: { colors: [string, string] }) {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-white/40 bg-surface/70 px-4 py-4 shadow-lg backdrop-blur-md"
      style={{ animation: "tw-rise 0.3s ease-out" }}
      role="status"
    >
      <div className="relative size-10 shrink-0">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0%, ${colors[0]} 55%, ${colors[1]} 100%)`,
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))",
            animationDuration: "1.1s",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 m-auto size-2.5 animate-pulse rounded-full"
          style={{ background: colors[1], boxShadow: `0 0 12px 3px ${colors[0]}88` }}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Publishing to your socials...</p>
        <p className="text-xs text-muted">This can take up to a minute - please keep this window open.</p>
      </div>
    </div>
  );
}

const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", facebook: "Facebook" };

/** One card per platform from the publish workflow, with whatever follow-up action its result allows. */
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
  const brand = PLATFORMS.find((x) => x.id === platform)!;
  const action = r.action ?? "";
  // A link means it's live, whatever the status field still says.
  const live = r.status === "success" || !!r.postUrl;
  const pending = !live && r.status === "processing";
  const tone = live ? "ok" : pending || r.status === "not_posted" || r.status === "already_posted" ? "warn" : "bad";

  const title = live
    ? `Published on ${name}`
    : pending
      ? `Publishing on ${name}...`
      : r.status === "already_posted"
        ? `Already posted to ${name}`
        : r.status === "not_posted"
          ? `Not posted to ${name} yet`
          : `Couldn't post to ${name}`;
  const wait = r.status === "failed" && r.code === "RATE_LIMITED" && r.retryAfterSeconds ? ` (about ${Math.ceil(r.retryAfterSeconds / 60)} min)` : "";
  const subtitle = live ? "Your post is now live!" : pending ? "Publishing is in progress. Check again shortly." : `${r.message ?? ""}${wait}`;

  const canRetry = r.status === "failed" ? !!r.retryable : r.status === "not_posted" && action === "post_single";
  const canManual = r.status === "failed" && action.includes("post_manually");
  const canCheck = pending || (!live && action === "check_status");
  const pill = "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition hover:-translate-y-px active:scale-95 disabled:pointer-events-none disabled:opacity-50";
  const outline = cn(pill, "border-line bg-surface/80 text-ink hover:border-accent");

  return (
    <li
      className={cn(
        "flex items-start gap-3.5 rounded-2xl border bg-gradient-to-br to-transparent p-3.5 shadow-lg backdrop-blur-md",
        tone === "ok" && "border-ok/30 from-ok/10",
        tone === "warn" && "border-warn/30 from-warn/10",
        tone === "bad" && "border-danger/30 from-danger/10",
      )}
      style={{ animation: "tw-rise 0.35s ease-out" }}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-xl text-white ring-2 ring-white/50"
        style={{ background: brand.gradient, boxShadow: `0 6px 16px -3px ${brand.glow}` }}
        aria-hidden="true"
      >
        {platform === "instagram" ? <InstagramIcon className="size-5" /> : <FacebookIcon className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
          {title}
          {tone === "ok" && <CheckCircle2 className="size-4 text-ok" />}
          {tone === "warn" && <Clock className="size-4 text-warn" />}
          {tone === "bad" && <AlertTriangle className="size-4 text-danger" />}
        </p>
        {subtitle && <p className={cn("mt-0.5 break-words text-sm", tone === "bad" ? "text-danger" : "text-muted")}>{subtitle}</p>}
        {(live && r.postUrl) || canCheck || canRetry || canManual ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {live && r.postUrl && (
              <a
                href={r.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(pill, "border-white/40 text-white shadow-md")}
                style={{ background: brand.gradient, boxShadow: `0 6px 14px -4px ${brand.glow}` }}
              >
                View on {name} <ExternalLink className="size-3.5" />
              </a>
            )}
            {canCheck && (
              <button type="button" onClick={onCheck} disabled={busy} className={outline}>
                <RefreshCw className="size-3.5" /> Check status
              </button>
            )}
            {canRetry && (
              <button type="button" onClick={onRetry} disabled={busy} className={outline}>
                {r.status === "not_posted" ? `Post to ${name} only` : "Try again"}
              </button>
            )}
            {canManual && (
              <button type="button" onClick={onManual} disabled={busy} className={outline}>
                <Copy className="size-3.5" /> Copy caption &amp; open {name}
              </button>
            )}
          </div>
        ) : null}
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
  const brand = PLATFORMS.find((x) => x.id === platform)!;
  const overLimit = caption.length > CAPTION_LIMIT;

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
    // No answer to read (gateway timeout, dropped connection) or a "still publishing" refusal:
    // the post may have gone out, so show what was saved instead of an error.
    if (!res.results && res.action === "check_status") {
      await checkStatus(platforms, true);
      return;
    }
    setResponse(res);
    setBusy(false);
    if (res.ok && !res.processing) toast("ok", "Posted successfully");
  }

  async function checkStatus(only: SocialPlatform[] = targets, fromPublish = false) {
    if (busy && !fromPublish) return;
    setBusy(true);
    const res = await fetchSocialStatus(v.id);
    if (!res.ok) {
      setResponse(res);
    } else {
      // Only the platforms this post was for - older attempts for the other one aren't news.
      const results = Object.fromEntries(Object.entries(res.results ?? {}).filter(([p]) => only.includes(p as SocialPlatform)));
      setResponse(
        Object.keys(results).length > 0
          ? { ok: true, results }
          : { ok: false, code: "SERVICE_DOWN", message: "Couldn't confirm the post. Check the platform before trying again, to avoid a duplicate.", retryable: true, action: "retry_later" },
      );
    }
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
      subtitle={
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-ink">
          <span className="flex shrink-0 -space-x-0.5">
            <InstagramIcon className="size-3.5 text-[#dd2a7b]" />
            <FacebookIcon className="size-3.5 text-[#1877f2]" />
          </span>
          <span className="truncate">
            {v.make} {v.model} · {displayReg(v.registrationNo)}
          </span>
        </span>
      }
      onClose={onClose}
      onSubmit={() => publish()}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            {response ? "Close" : "Cancel"}
          </Button>
          <button
            type="submit"
            disabled={busy || !caption.trim() || overLimit || selected.size === 0}
            className="relative inline-flex flex-[2] cursor-pointer select-none items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-2.5 text-sm font-bold tracking-wide text-white transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100"
            style={{
              background: brand.gradient,
              boxShadow: `inset 0 2px 5px rgba(255, 255, 255, 0.6), inset 0 -3px 6px rgba(15, 23, 42, 0.35), 0 8px 20px -4px ${brand.glow}`,
              border: "1px solid rgba(255, 255, 255, 0.45)",
            }}
          >
            {/* Upper specular gloss highlight */}
            <span className="pointer-events-none absolute left-3 right-3 top-0.5 h-[45%] rounded-full bg-gradient-to-b from-white/70 to-transparent" />
            <span className="relative z-10 flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {busy ? "Publishing…" : "Publish"}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="h-1 rounded-full transition-all duration-500" style={{ background: brand.gradient, boxShadow: `0 2px 10px -1px ${brand.glow}` }} aria-hidden="true" />

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
                "relative inline-flex select-none items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-sm font-semibold ease-[cubic-bezier(0.34,1.56,0.64,1)] transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-60",
                platform === p.id
                  ? "border border-white/50 text-white hover:scale-105"
                  : "border border-surface/60 bg-surface/40 text-muted shadow-inner ring-1 ring-line/60 backdrop-blur-md hover:bg-surface/70 hover:text-ink",
              )}
              style={
                platform === p.id
                  ? {
                      background: p.gradient,
                      boxShadow: `inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -2px 5px rgba(15,23,42,0.25), 0 4px 12px ${p.tabGlow}`,
                    }
                  : undefined
              }
            >
              {/* Top-down gloss reflection on the selected capsule */}
              {platform === p.id && <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/30 to-transparent" />}
              <span className={cn("relative z-10 flex items-center gap-2", platform === p.id && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]")}>
                {p.icon}
                {p.label}
              </span>
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label htmlFor="social-caption" className="text-sm font-semibold">
              Caption
            </label>
            <span className={cn("text-xs tabular-nums", overLimit ? "font-semibold text-danger" : "text-muted")} aria-live="polite">
              {caption.length.toLocaleString("en-IN")} / {CAPTION_LIMIT.toLocaleString("en-IN")}
            </span>
          </div>
          <textarea
            id="social-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
            disabled={busy}
            placeholder="Write a caption for your post..."
            aria-invalid={overLimit}
            className={cn(
              "w-full resize-y rounded-2xl border bg-accent/5 p-3.5 text-sm leading-relaxed outline-none transition placeholder:text-muted/70 focus:bg-surface focus:ring-2",
              overLimit ? "border-danger focus:ring-danger/30" : "border-line focus:border-accent focus:ring-accent/25",
            )}
          />
          {overLimit && <p className="mt-1 text-xs text-danger">Captions can be at most {CAPTION_LIMIT.toLocaleString("en-IN")} characters.</p>}
        </div>

        <div>
          <p className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold">
            Photos in the post
            <span className="text-xs font-normal text-muted">
              {selected.size} of {slots.length} selected
            </span>
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
                    disabled={busy}
                    onClick={() => toggle(p.slot)}
                    className={cn("group relative rounded-xl p-0.5 text-left transition-all duration-200 active:scale-[0.97]", on ? "shadow-lg" : "bg-line opacity-70 hover:opacity-100")}
                    style={on ? { background: brand.gradient, boxShadow: `0 8px 18px -6px ${brand.glow}` } : undefined}
                  >
                    <span className="relative block overflow-hidden rounded-[10px] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.photos[p.slot]} alt={p.label} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-5 text-xs font-medium text-white">{p.label}</span>
                    </span>
                    {on && (
                      <span
                        className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-white shadow-md ring-2 ring-white"
                        style={{ background: brand.gradient }}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
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
            {busy && <PublishingLoader colors={brand.colors} />}
            {!busy && response?.results && (
              <ul className="space-y-2.5" style={{ animation: "tw-rise 0.35s ease-out" }}>
                {(["instagram", "facebook"] as const).map((p) => {
                  const r = response.results?.[p];
                  return r ? (
                    <ResultRow key={p} platform={p} r={r} busy={busy} onRetry={() => publish([p])} onCheck={() => checkStatus([p])} onManual={() => postManually(p)} />
                  ) : null;
                })}
              </ul>
            )}
            {!busy && response && !response.results && (
              <div
                className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-gradient-to-br from-danger/10 to-transparent p-3.5 text-sm shadow-lg backdrop-blur-md"
                style={{ animation: "tw-rise 0.35s ease-out" }}
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-danger">{response.message ?? "Something went wrong. Try again in a minute."}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {response.action === "check_status" && (
                      <Button size="sm" type="button" onClick={() => checkStatus()} disabled={busy}>
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
