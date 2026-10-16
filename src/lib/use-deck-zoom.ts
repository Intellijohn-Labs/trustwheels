"use client";

import { useSyncExternalStore } from "react";

/** How big the Stock Deck's cards are: Compact scans many at once, Large is for reading and thumbs. */
export type DeckZoom = "compact" | "normal" | "large";

export const ZOOM_LEVELS: DeckZoom[] = ["compact", "normal", "large"];

export const ZOOM_LABEL: Record<DeckZoom, string> = { compact: "Compact", normal: "Standard", large: "Large" };

const KEY = "tw-deck-zoom";
const listeners = new Set<() => void>();
let current: DeckZoom | undefined;

function read(): DeckZoom {
  try {
    const v = localStorage.getItem(KEY);
    return v === "compact" || v === "large" ? v : "normal";
  } catch {
    return "normal";
  }
}

const getSnapshot = () => (current ??= read());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDeckZoom(zoom: DeckZoom) {
  current = zoom;
  try {
    localStorage.setItem(KEY, zoom);
  } catch {
    // storage blocked: the choice still holds for this page view
  }
  listeners.forEach((l) => l());
}

/**
 * The saved density, kept in localStorage. Read through useSyncExternalStore so the server render
 * (and the first client render) use "normal" and the saved choice slots in right after hydration,
 * with no mismatch warning.
 */
export function useDeckZoom(): [DeckZoom, (zoom: DeckZoom) => void] {
  const zoom = useSyncExternalStore(subscribe, getSnapshot, () => "normal" as DeckZoom);
  return [zoom, setDeckZoom];
}
