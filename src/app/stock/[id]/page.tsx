"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { celebrate } from "@/lib/celebrate";
import { ArrowLeft, Bike, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { deleteVehicle, setAskingPrice, useVehicle } from "@/lib/stock-store";
import { PHOTO_SLOTS, branchName } from "@/lib/masters";
import { displayReg, formatDateTime, formatIsoDate, formatNumber, formatPaise } from "@/lib/format";
import type { Vehicle } from "@/lib/types";
import { Button, StageBadge, cn } from "@/components/ui";
import { VerifyButton } from "@/components/verify-button";
import { VerifyTimer } from "@/components/verify-timer";
import { SaleBadge } from "@/components/vehicle-row";
import { SaleActions } from "@/components/sale-actions";
import { ConfirmDeleteDialog } from "@/components/panels/confirm-delete-dialog";
import { RupeeInput } from "@/components/panels/job-card-dialog";
import { useAction } from "@/components/toast";
import { useNow } from "@/lib/use-now";
import { useRole } from "@/lib/role-context";
import { ShieldX } from "lucide-react";
import { SLA, TRANSFER_STEPS } from "@/lib/masters";
import { Pill } from "@/components/ui";
import { awaitingGate, currentBranchId, inTransit, isCodeRed, landedCostPaise, paymentDue, reconCostPaise, reconFlag, reconHours, transferProgress, transitBreached, transitHours } from "@/lib/workflow";
import { DocumentVault } from "@/components/vehicle/document-vault";

export default function VehicleDetailPage() {
  return (
    <Suspense>
      <VehicleDetail />
    </Suspense>
  );
}

function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const created = useSearchParams().get("created") === "1";
  const { vehicle: v, ready } = useVehicle(id);
  const now = useNow();
  const { can, inScope, roleDef } = useRole();
  const [bannerOpen, setBannerOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const celebrated = useRef(false);
  useEffect(() => {
    if (created && ready && !celebrated.current) {
      celebrated.current = true;
      celebrate();
    }
  }, [created, ready]);

  if (!ready) return <p className="text-sm text-muted">Loading…</p>;
  if (!v)
    return (
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <p className="font-medium">Vehicle not found</p>
        <Link href="/stock" className="mt-2 inline-block text-sm text-brand">
          Back to stock
        </Link>
      </div>
    );

  if (!inScope(v.branchId))
    return (
      <div className="mx-auto max-w-lg py-10 text-center" data-testid="forbidden">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <ShieldX className="size-7" />
        </div>
        <p className="mt-4 font-mono text-sm font-semibold text-danger">403 · Outside your scope</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">This vehicle belongs to {branchName(v.branchId)}</h1>
        <p className="mt-2 text-sm text-muted">{roleDef.label} can only see vehicles from their own branches.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Stock
        </Link>
        {can("stock.delete") && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${v.make} ${v.model}`}>
            <Trash2 className="size-3.5" /> Delete vehicle
          </Button>
        )}
      </div>

      {created && bannerOpen && (
        <div className="flex items-start gap-3 rounded-2xl border border-ok/30 bg-ok-soft p-4 text-ok">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Vehicle saved</p>
            <p>
              Provisional ID <span className="font-mono font-semibold">{v.provisionalId}</span>. Next step: attach documents.
            </p>
          </div>
          <button onClick={() => setBannerOpen(false)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {v.make} {v.model} {v.variant && <span className="font-normal text-muted">{v.variant}</span>}
          </h1>
          <p className="mt-0.5 font-mono tracking-wide text-muted">{displayReg(v.registrationNo)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{formatPaise(v.agreedValuePaise)}</p>
          <p className="text-xs text-muted">Agreed value</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={v.stage} />
        <SaleBadge vehicle={v} />
        <Chip label="Provisional" value={v.provisionalId} />
        {v.stockId ? <Chip label="Stock ID" value={v.stockId} /> : <Chip label="Stock ID" value="Issued at Angamaly" muted />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <VerifyButton vehicle={v} size="lg" />
        {v.verified ? (
          <p className="text-sm text-muted">
            by {v.verified.by} · {formatDateTime(v.verified.at)}
          </p>
        ) : (
          <VerifyTimer vehicle={v} now={now} className="px-3 py-1 text-sm" />
        )}
      </div>

      <SaleCard vehicle={v} />
      <WorkflowCard vehicle={v} now={now} />

      <div className="space-y-4">
        <Gallery vehicle={v} />

        <DocumentVault vehicle={v} />

        <Card title="Vehicle">
          <Specs
            rows={[
              ["Year", v.year],
              ["Fuel", v.fuel === "electric" ? "Electric" : "Petrol"],
              [v.fuel === "electric" ? "Motor" : "Engine", v.engineCc ? `${formatNumber(v.engineCc)} ${v.fuel === "electric" ? "W" : "cc"}` : "—"],
              ["Odometer", `${formatNumber(v.odometerKm)} km`],
              ["Colour", v.colour],
              ["Owners", v.owners >= 4 ? "4+" : v.owners],
              ["Chassis no.", <Mono key="c">{v.chassisNo}</Mono>],
              ["Engine no.", <Mono key="e">{v.engineNo}</Mono>],
            ]}
          />
        </Card>

        <Card title="Insurance & finance">
          <Specs
            rows={[
              ["Insurance till", v.insuranceValidTill ? formatIsoDate(v.insuranceValidTill) : "—"],
              ["Policy no.", v.insurancePolicyNo || "—"],
              ["Finance", v.financeStatus === "financed" ? `Under finance · ${v.financier}` : "Free"],
              ...(v.financeStatus === "financed" ? [["NOC", v.nocStatus === "received" ? "Received" : "Pending"] as [string, string]] : []),
            ]}
          />
        </Card>

        <Card title="Condition">
          <Specs
            rows={[
              ["Accident history", { none: "None", minor: "Minor", major: "Major" }[v.accidentHistory]],
              ["Notes", v.conditionNotes || "—"],
              ["Known defects", v.knownDefects || "—"],
            ]}
          />
        </Card>

        <Card title="Intake & seller">
          <Specs
            rows={[
              ["Source", v.source === "exchange" ? "Branch exchange" : "Direct purchase"],
              ["Branch", branchName(v.branchId)],
              ["Seller", v.seller.name],
              ["Mobile", `+91 ${v.seller.phone.slice(0, 5)} ${v.seller.phone.slice(5)}`],
              ["Entered by", `${v.enteredBy} · ${formatDateTime(v.createdAt)}`],
            ]}
          />
        </Card>
      </div>

      {confirmDelete && (
        <ConfirmDeleteDialog
          count={1}
          items={[`${v.make} ${v.model} · ${displayReg(v.registrationNo)}`]}
          noun="vehicle"
          onConfirm={async () => {
            await deleteVehicle(v.id);
            router.push("/stock");
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/** Where the vehicle is in the operations workflow, step by step, with SLA state. */
function WorkflowCard({ vehicle: v, now }: { vehicle: Vehicle; now: number }) {
  const pay = paymentDue(v, now);
  const transfer = transferProgress(v);
  const rows: [string, React.ReactNode][] = [
    [
      "Seller payment",
      v.purchase ? (
        <>
          {formatPaise(v.purchase.netPayablePaise)} · {v.purchase.payout.status}
          {pay && !pay.paid && <> · due {formatIsoDate(pay.due)}</>}{" "}
          {pay?.status === "overdue" && <Pill tone="danger">Overdue</Pill>}
          {pay?.status === "due-soon" && <Pill tone="warn">Due soon</Pill>}
        </>
      ) : v.verified ? (
        <>Purchase value not entered {pay?.status === "overdue" ? <Pill tone="danger">Overdue</Pill> : null}</>
      ) : (
        "Waiting for verification"
      ),
    ],
    [
      "Dispatch",
      v.dispatch ? (
        <>
          {v.dispatch.rider} · {branchName(v.dispatch.from)} → {branchName(v.dispatch.to)} · {formatDateTime(v.dispatch.handoverAt)} ·{" "}
          {Math.round(transitHours(v, now))}h in transit {transitBreached(v, now) && <Pill tone="danger">Over {SLA.transitHours}h</Pill>}
          {v.dispatch.notes && <span className="mt-0.5 block text-xs text-muted">Note: {v.dispatch.notes}</span>}
        </>
      ) : (
        "Not dispatched"
      ),
    ],
    ["Received at Angamaly", v.receipt ? `${v.receipt.by} · ${formatDateTime(v.receipt.at)}` : "—"],
    [
      "Current location",
      <>
        {branchName(currentBranchId(v))} {inTransit(v) && <Pill tone="warn">In transit</Pill>}
      </>,
    ],
    [
      "Reconditioning",
      v.recon ? (
        <>
          {v.recon.supervisor} · job card {formatPaise(reconCostPaise(v))}
          {v.recon.completed ? " · signed off" : ""}{" "}
          {v.stage === 8 && (
            <>
              · {Math.round(reconHours(v, now))}h{" "}
              {!v.gate && reconFlag(v, now) !== "ok" && (
                <Pill tone={reconFlag(v, now) === "red72" ? "danger" : "warn"}>RED {reconFlag(v, now) === "red72" ? "72h" : "48h"}</Pill>
              )}
            </>
          )}
        </>
      ) : (
        "—"
      ),
    ],
    [
      "Quality gate",
      v.gate
        ? `Approved by ${v.gate.by} · ${formatDateTime(v.gate.at)}`
        : awaitingGate(v)
          ? "Waiting for the manager"
          : v.recon?.completed
            ? "Skipped - returned to stock evaluation"
            : "—",
    ],
    ["Landed cost", <AskingPriceCell key="landed-cost" vehicle={v} />],
    [
      "Ownership transfer",
      v.sale?.status === "sold" ? (
        <>
          {transfer.done}/{transfer.total} steps{v.delivery?.released ? ` · released by ${v.delivery.released.by}` : ""}
          {v.delivery?.delivered ? ` · delivered ${formatDateTime(v.delivery.delivered.at)}` : ""}{" "}
          {isCodeRed(v, now) && <Pill tone="danger">Code Red</Pill>}
        </>
      ) : (
        "—"
      ),
    ],
  ];
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">Workflow</h2>
      <dl className="grid gap-2.5 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="flex flex-col gap-0.5 border-b border-line pb-2.5 last:border-0 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="font-medium sm:text-right">{val}</dd>
          </div>
        ))}
      </dl>
      {v.sale?.status === "sold" && !v.delivery?.delivered && (
        <p className="mt-3 text-xs text-muted">
          Delivery is blocked until every transfer step is confirmed: {TRANSFER_STEPS.map((s) => s.label).join(" · ")}.
        </p>
      )}
    </section>
  );
}

/**
 * The asking/selling price, editable in place by anyone with `stock.verify` - the same permission
 * that already gates the "Ready for Sale" decision and its price-confirmation dialog - regardless
 * of the vehicle's current saleReadiness status, so Admin can correct it before or after the
 * vehicle has been marked Ready for Sale. Read-only for every other role, and (same as that
 * dialog) refused once the vehicle is actually sold - setAskingPrice() enforces that too.
 */
function AskingPriceCell({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const canEdit = can("stock.verify") && !v.sale;
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(v.proposedPricePaise ? String(v.proposedPricePaise / 100) : "");
  const { run, busy } = useAction();

  async function save() {
    if (await run(() => setAskingPrice(v.id, Number(price) * 100), "Asking price updated")) setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
        <RupeeInput id="asking-price-edit" value={price} onChange={setPrice} disabled={busy} />
        <Button size="sm" variant="primary" disabled={busy || !price || Number(price) <= 0} onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span>
        {formatPaise(landedCostPaise(v))}
        {v.proposedPricePaise != null && ` · asking ${formatPaise(v.proposedPricePaise)}`}
      </span>
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          <Pencil className="size-3" /> {v.proposedPricePaise != null ? "Edit" : "Set price"}
        </button>
      )}
    </span>
  );
}

function SaleCard({ vehicle: v }: { vehicle: Vehicle }) {
  const sale = v.sale;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">Sale</h2>
      {sale && (
        <dl className="mb-4 grid gap-2.5 text-sm sm:grid-cols-2">
          <Row k="Customer" v={`${sale.customer.name} · +91 ${sale.customer.phone.slice(0, 5)} ${sale.customer.phone.slice(5)}`} />
          {sale.bookedAt && <Row k="Booked" v={`${formatDateTime(sale.bookedAt)} · ${formatPaise(sale.bookingAmountPaise ?? 0)} advance`} />}
          {sale.soldAt && <Row k="Sold" v={`${formatDateTime(sale.soldAt)} · ${formatPaise(sale.salePricePaise ?? 0)}`} />}
          {sale.salePricePaise != null && <Row k="Above purchase value" v={formatPaise(sale.salePricePaise - v.agreedValuePaise)} />}
        </dl>
      )}
      {sale?.status === "sold" ? (
        <p className="text-sm text-muted">This vehicle is sold.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <SaleActions vehicle={v} size="lg" />
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Chip({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs">
      <span className="text-muted">{label}</span>
      <span className={cn(muted ? "text-faint" : "font-mono font-medium")}>{value}</span>
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono">{children}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Specs({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      {rows.map(([k, val]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-line pb-2.5 last:border-0">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium break-all">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

function Gallery({ vehicle }: { vehicle: Vehicle }) {
  const shots = PHOTO_SLOTS.filter((p) => vehicle.photos[p.slot]);
  const [active, setActive] = useState(shots[0]?.slot);
  const src = active && vehicle.photos[active];

  if (!shots.length)
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-line bg-sunken text-faint">
        <div className="text-center">
          <Bike className="mx-auto size-12" strokeWidth={1.25} />
          <p className="mt-1 text-sm">No photos (demo record)</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl bg-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={src} alt={active} className="aspect-[16/9] w-full object-contain" />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {shots.map((p) => (
          <button
            key={p.slot}
            onClick={() => setActive(p.slot)}
            className={cn("overflow-hidden rounded-lg border-2", active === p.slot ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}
            title={p.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            <img src={vehicle.photos[p.slot]} alt={p.label} className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
