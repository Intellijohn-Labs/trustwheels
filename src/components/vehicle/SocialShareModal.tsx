"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useToast } from "../toast";
import { branchName, PHOTO_SLOTS } from "@/lib/masters";
import { currentBranchId } from "@/lib/workflow";
import { displayReg, formatNumber, formatPaise } from "@/lib/format";
import type { PhotoSlot, Vehicle } from "@/lib/types";
import { Button, cn } from "../ui";
import { Dialog } from "../panels/dialog";

type Platform = "instagram" | "facebook" | "both";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "both", label: "Both (Instagram & Facebook)" },
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
    `📞 Contact TrustWheels for bookings & test drives! #TrustWheels #UsedCars #KeralaCars`,
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
          <Button type="submit" size="lg" variant="primary" className="flex-[2]" disabled={!caption.trim()}>
            <Copy className="size-4" /> Copy Caption &amp; Open <ExternalLink className="size-4" />
          </Button>
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
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                platform === p.id ? "border-transparent bg-accent text-white" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {p.label}
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Share to Social Media"
        aria-label={`Share ${v.make} ${v.model} to social media`}
        className="grid size-8 place-items-center rounded-full border border-line bg-surface text-muted transition hover:border-accent hover:text-accent"
      >
        <Share2 className="size-3.5" />
      </button>
      {open && <SocialShareModal vehicle={v} onClose={() => setOpen(false)} />}
    </>
  );
}
