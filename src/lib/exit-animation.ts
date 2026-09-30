"use client";

/*
 * Smooth "collapse then remove" for a deleted row/card - CSS transitions only, no animation
 * library. React removes a deleted vehicle from the list the instant the store updates, which
 * would otherwise make it vanish instantly; this finds the DOM node(s) for the ids about to be
 * deleted (matched by `data-vehicle-id`), animates them down to nothing, then runs the real
 * delete once the animation has actually played. Used by both the single-row delete button and
 * the bulk-delete toolbar, so every delete across the app animates the same way.
 */

const EXIT_MS = 260;

export async function collapseThenRun(ids: string[], action: () => Promise<unknown>) {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const els = typeof document === "undefined" ? [] : ids.map((id) => document.querySelector<HTMLElement>(`[data-vehicle-id="${CSS.escape(id)}"]`)).filter((el): el is HTMLElement => !!el);

  if (reduceMotion || els.length === 0) {
    await action();
    return;
  }

  els.forEach((el) => {
    el.style.overflow = "hidden";
    el.style.maxHeight = `${el.offsetHeight}px`;
  });
  // Force a reflow so the browser commits the explicit max-height above before animating to 0 -
  // otherwise it would just skip straight to the end state instead of transitioning.
  void els[0].offsetHeight;
  requestAnimationFrame(() => {
    els.forEach((el) => {
      el.style.transition = `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease, max-height ${EXIT_MS}ms ease, margin ${EXIT_MS}ms ease, padding ${EXIT_MS}ms ease`;
      el.style.opacity = "0";
      el.style.transform = "scale(0.97)";
      el.style.maxHeight = "0px";
      el.style.marginTop = "0px";
      el.style.marginBottom = "0px";
      el.style.paddingTop = "0px";
      el.style.paddingBottom = "0px";
      el.style.pointerEvents = "none";
    });
  });
  await new Promise((r) => setTimeout(r, EXIT_MS));
  try {
    await action();
  } catch (e) {
    // The mutation was refused (a guard threw) - restore the row instead of leaving it
    // collapsed for something that never actually happened, and let the caller's own error
    // handling (a dialog's inline failure message, a toast) still see the rejection.
    els.forEach((el) => {
      el.style.transition = "none";
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
      el.style.removeProperty("max-height");
      el.style.removeProperty("margin-top");
      el.style.removeProperty("margin-bottom");
      el.style.removeProperty("padding-top");
      el.style.removeProperty("padding-bottom");
      el.style.removeProperty("pointer-events");
      el.style.removeProperty("overflow");
    });
    throw e;
  }
}
