"use client";

import { useState } from "react";
import { BadgeCheck, CheckCircle2, FileWarning, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { useScopedVehicles } from "@/lib/scoped";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { approveGate, sendBackToRecon } from "@/lib/stock-store";
import { PHOTO_SLOTS, documentLabel } from "@/lib/masters";
import { formatDateTime, formatPaise } from "@/lib/format";
import { missingDocuments } from "@/lib/documents";
import { awaitingGate, landedCostPaise, reconCostPaise, reconHours } from "@/lib/workflow";
import type { Vehicle } from "@/lib/types";
import { DataTable } from "../data-table";
import { useAction } from "../toast";
import { Button, EmptyState, Field, Panel, Pill, cn, textareaClass } from "../ui";
import { Dialog, VehicleSummary, useInlineAction } from "./dialog";
import { PhotoGrid } from "./job-card-dialog";
import { ReconFlagPill } from "./recon-panel";
import { VehicleCell, formatHours } from "./vehicle-cell";

/**
 * Vehicles whose job card the supervisor has signed off, waiting for the Angamaly manager.
 * Embedded by the /quality-gate page and the Gatekeeper dashboard.
 */
export function QualityGatePanel({ limit, compact }: { limit?: number; compact?: boolean }) {
  const { vehicles, ready } = useScopedVehicles();
  const now = useNow(60_000);
  const queue = vehicles.filter(awaitingGate).sort((a, b) => a.recon!.completed!.at.localeCompare(b.recon!.completed!.at));
  const shown = limit ? queue.slice(0, limit) : queue;

  return (
    <Panel
      flush
      title="Waiting for quality gate"
      description={`${queue.length} signed off by the supervisor. Approve to put on display, or send back with a reason.`}
    >
      {!ready ? (
        <EmptyState>Loading…</EmptyState>
      ) : queue.length === 0 ? (
        <EmptyState>Nothing waiting for the quality check.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((v) => (
            <GateItem key={v.id} vehicle={v} now={now} compact={compact} />
          ))}
        </ul>
      )}
      {limit && queue.length > limit && <p className="border-t border-line px-4 py-2.5 text-xs text-muted sm:px-5">+{queue.length - limit} more on the quality gate page</p>}
    </Panel>
  );
}

function GateItem({ vehicle: v, now, compact }: { vehicle: Vehicle; now: number; compact?: boolean }) {
  const recon = v.recon!;
  const { can } = useRole();
  const { run, busy } = useAction();
  const [sendBack, setSendBack] = useState(false);
  const landed = landedCostPaise(v);
  const proposed = v.proposedPricePaise;
  const intake = PHOTO_SLOTS.flatMap((s) => (v.photos[s.slot] ? [v.photos[s.slot]!] : []));
  const photos = [...recon.photos, ...intake];
  const missingDocs = missingDocuments(v);

  return (
    <li className="space-y-3 px-4 py-4 sm:px-5" data-testid="gate-item">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <VehicleCell vehicle={v} />
        <div className="flex flex-wrap items-center gap-1.5">
          <ReconFlagPill vehicle={v} now={now} />
          {v.verified ? (
            <Pill tone="ok" icon={<BadgeCheck className="size-3" />}>
              Documents verified
            </Pill>
          ) : (
            <Pill tone="danger" icon={<ShieldAlert className="size-3" />}>
              Documents not verified
            </Pill>
          )}
          {missingDocs.length === 0 ? (
            <Pill tone="ok" icon={<BadgeCheck className="size-3" />}>
              Vault complete
            </Pill>
          ) : (
            <Pill tone="danger" icon={<FileWarning className="size-3" />}>
              {missingDocs.length} document{missingDocs.length > 1 ? "s" : ""} missing
            </Pill>
          )}
        </div>
      </div>

      <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2 text-sm", !compact && "sm:grid-cols-4")}>
        <div>
          <dt className="text-xs text-muted">Signed off</dt>
          <dd className="font-medium">{recon.completed!.by}</dd>
          <dd className="text-xs text-muted">{formatDateTime(recon.completed!.at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">In workshop</dt>
          <dd className="font-medium tabular-nums">{formatHours(reconHours(v, now))}</dd>
          <dd className="text-xs text-muted">{recon.sendBacks.length ? `Sent back ${recon.sendBacks.length}×` : "First inspection"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Landed cost</dt>
          <dd className="font-medium tabular-nums">{formatPaise(landed)}</dd>
          <dd className="text-xs text-muted">incl. job card {formatPaise(reconCostPaise(v))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Proposed price</dt>
          <dd className="font-medium tabular-nums">{proposed != null ? formatPaise(proposed) : "Not set"}</dd>
          {proposed != null && (
            <dd className={cn("text-xs font-medium", proposed < landed ? "text-danger" : "text-ok")}>
              {proposed < landed ? "Below cost" : "Margin"} {formatPaise(proposed - landed)}
            </dd>
          )}
        </div>
      </dl>

      {!compact && recon.items.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {recon.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">
                <span className="text-xs text-muted capitalize">{i.kind}</span> · {i.description}
              </span>
              <span className="tabular-nums">{formatPaise(i.costPaise)}</span>
            </li>
          ))}
        </ul>
      )}

      {photos.length ? (
        <PhotoGrid photos={compact ? photos.slice(0, 4) : photos} label="Vehicle photo" />
      ) : (
        <p className="text-xs text-muted">No photos attached.</p>
      )}

      {recon.sendBacks.at(-1) && (
        <p className="flex items-start gap-1.5 text-xs text-warn">
          <Undo2 className="mt-0.5 size-3 shrink-0" /> Last sent back: {recon.sendBacks.at(-1)!.reason}
        </p>
      )}

      {can("gate.approve") && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              disabled={busy || missingDocs.length > 0}
              title={missingDocs.length > 0 ? `Upload and verify: ${missingDocs.map(documentLabel).join(", ")}` : undefined}
              onClick={() => run(() => approveGate(v.id), `${v.make} ${v.model} approved and on display`)}
            >
              <ShieldCheck className="size-4" /> Approve for display
            </Button>
            <Button variant="warn" onClick={() => setSendBack(true)}>
              <Undo2 className="size-4" /> Send back
            </Button>
          </div>
          {missingDocs.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-danger">
              <FileWarning className="mt-0.5 size-3 shrink-0" /> Complete the document vault first: {missingDocs.map(documentLabel).join(" · ")}.
            </p>
          )}
        </div>
      )}
      {sendBack && <SendBackDialog vehicle={v} onClose={() => setSendBack(false)} />}
    </li>
  );
}

function SendBackDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submit, failure, busy } = useInlineAction();
  const missing = submitted && !reason.trim() ? "Give a reason so the supervisor knows what to fix" : undefined;

  async function onSubmit() {
    setSubmitted(true);
    if (!reason.trim()) return;
    if (await submit(() => sendBackToRecon(vehicle.id, reason), "Sent back to reconditioning")) onClose();
  }

  return (
    <Dialog
      title="Send back to reconditioning"
      subtitle={<VehicleSummary vehicle={vehicle} />}
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        <>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" type="submit" variant="warn" className="flex-[2]" disabled={busy}>
            <Undo2 className="size-4" /> Send back
          </Button>
        </>
      }
    >
      <Field label="What needs fixing" htmlFor="sendback-reason" required error={missing ?? failure} hint="The supervisor sees this on the job card. The reconditioning clock keeps running.">
        <textarea id="sendback-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass(!!(missing ?? failure))} />
      </Field>
    </Dialog>
  );
}

/** Latest quality-gate approvals, newest first. */
export function RecentlyApprovedPanel({ limit = 8 }: { limit?: number }) {
  const { vehicles, ready } = useScopedVehicles();
  const rows = vehicles.filter((v) => v.gate).sort((a, b) => b.gate!.at.localeCompare(a.gate!.at));

  return (
    <Panel flush title="Recently approved">
      <DataTable
        rows={ready ? rows.slice(0, limit) : []}
        rowKey={(v) => v.id}
        empty="Nothing approved yet."
        columns={[
          { header: "Vehicle", cell: (v) => <VehicleCell vehicle={v} /> },
          {
            header: "Approved",
            cell: (v) => (
              <div className="text-xs whitespace-nowrap">
                <p className="flex items-center gap-1 font-medium text-ok">
                  <CheckCircle2 className="size-3" /> {v.gate!.by}
                </p>
                <p className="text-muted">{formatDateTime(v.gate!.at)}</p>
              </div>
            ),
          },
          { header: "Workshop time", align: "right", cell: (v) => formatHours(reconHours(v, new Date(v.gate!.at).getTime())) },
          { header: "Landed cost", align: "right", cell: (v) => formatPaise(landedCostPaise(v)) },
          { header: "Price", align: "right", cell: (v) => (v.proposedPricePaise != null ? formatPaise(v.proposedPricePaise) : "–") },
        ]}
      />
    </Panel>
  );
}
