"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { BadgeIndianRupee, BookmarkCheck, Loader2, X } from "lucide-react";
import { bookVehicle, cancelBooking, sellVehicle } from "@/lib/stock-store";
import { useRole } from "@/lib/role-context";
import { celebrate } from "@/lib/celebrate";
import { useAction } from "./toast";
import { displayReg, formatDateTime, formatPaise, groupIndian } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { Field, cn, inputClass } from "./ui";

type Mode = "book" | "sell";

const button = "inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition disabled:opacity-50";

/** Book / Sell / Cancel buttons for a vehicle, depending on where it is in the sale flow. */
export function SaleActions({ vehicle, size = "sm" }: { vehicle: Vehicle; size?: "sm" | "lg" }) {
  const [mode, setMode] = useState<Mode>();
  const { can } = useRole();
  const { run, busy } = useAction();
  const big = size === "lg" && "h-12 flex-1 justify-center px-5 sm:flex-none";

  if (vehicle.sale?.status === "sold") return null;
  if (!can("sale.book")) return <p className="text-xs text-muted">Only the sales team can book or sell vehicles.</p>;

  if (!vehicle.verified)
    return <p className="text-xs text-muted">Verify this vehicle before booking or selling it.</p>;

  function cancel() {
    if (!confirm(`Cancel the booking for ${vehicle.sale!.customer.name}?`)) return;
    run(() => cancelBooking(vehicle.id), "Booking cancelled");
  }

  return (
    <>
      {vehicle.sale?.status === "booked" ? (
        <>
          <button type="button" onClick={() => setMode("sell")} className={cn(button, big, "bg-ok text-surface hover:brightness-110")}>
            <BadgeIndianRupee className="size-4" /> Mark as sold
          </button>
          <button type="button" onClick={cancel} disabled={busy} className={cn(button, big, "border border-line-strong text-muted hover:bg-sunken hover:text-ink")}>
            Cancel booking
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setMode("book")} className={cn(button, big, "border border-warn/40 bg-warn-soft text-warn hover:brightness-95")}>
            <BookmarkCheck className="size-4" /> Book this vehicle
          </button>
          <button type="button" onClick={() => setMode("sell")} className={cn(button, big, "bg-ok text-surface hover:brightness-110")}>
            <BadgeIndianRupee className="size-4" /> Sell this vehicle
          </button>
        </>
      )}
      {mode && <SaleDialog vehicle={vehicle} mode={mode} onClose={() => setMode(undefined)} />}
    </>
  );
}

function SaleDialog({ vehicle, mode, onClose }: { vehicle: Vehicle; mode: Mode; onClose: () => void }) {
  const booking = vehicle.sale?.status === "booked" ? vehicle.sale : undefined;
  const [name, setName] = useState(booking?.customer.name ?? "");
  const [phone, setPhone] = useState(booking?.customer.phone ?? "");
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const errors = {
    name: name.trim() ? undefined : "Required",
    phone: /^[6-9]\d{9}$/.test(phone) ? undefined : phone ? "Enter a 10-digit mobile number" : "Required",
    amount: Number(amount) > 0 ? undefined : mode === "book" ? "Enter the booking amount" : "Enter the sale price",
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    try {
      const customer = { name: name.trim(), phone };
      const paise = Number(amount) * 100;
      await (mode === "book" ? bookVehicle(vehicle.id, customer, paise) : sellVehicle(vehicle.id, customer, paise));
      celebrate();
      onClose();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const title = mode === "book" ? "Book this vehicle" : "Sell this vehicle";

  return createPortal(

    <div className="anim-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={onSubmit}
        noValidate
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md anim-dialog overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted">
              {vehicle.make} {vehicle.model} · <span className="font-mono">{displayReg(vehicle.registrationNo)}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken">
            <X className="size-5" />
          </button>
        </div>

        {booking && (
          <p className="mt-4 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            Booked by {booking.customer.name} on {formatDateTime(booking.bookedAt!)} · {formatPaise(booking.bookingAmountPaise ?? 0)} received
          </p>
        )}

        <div className="mt-4 grid gap-4">
          <Field label="Customer name" htmlFor="cust-name" required error={show("name")}>
            <input id="cust-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={inputClass(!!show("name"))} />
          </Field>
          <Field label="Customer mobile" htmlFor="cust-phone" required error={show("phone")}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">+91</span>
              <input
                id="cust-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className={cn(inputClass(!!show("phone")), "pl-12 tabular-nums")}
              />
            </div>
          </Field>
          <Field
            label={mode === "book" ? "Booking amount" : "Sale price"}
            htmlFor="sale-amount"
            required
            error={show("amount")}
            hint={`Purchase value ${formatPaise(vehicle.agreedValuePaise)}`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">₹</span>
              <input
                id="sale-amount"
                inputMode="numeric"
                value={groupIndian(amount)}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder={mode === "book" ? "10,000" : "1,25,000"}
                className={cn(inputClass(!!show("amount")), "pl-8 text-lg font-semibold tabular-nums")}
              />
            </div>
          </Field>
        </div>

        {failure && <p className="mt-4 text-sm font-medium text-danger">{failure}</p>}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-line-strong text-sm font-medium hover:bg-sunken">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={cn(
              "inline-flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl text-sm font-semibold text-surface disabled:opacity-60",
              mode === "book" ? "bg-warn" : "bg-ok",
            )}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {mode === "book" ? "Confirm booking" : "Confirm sale"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
