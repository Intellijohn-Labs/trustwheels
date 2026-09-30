"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Customer, Document, JobItem, NewVehicle, PaymentMode, SaleReadinessStatus, Vehicle } from "./types";
import type { TransferStep } from "./masters";
import { roleName } from "./user-names";
import { getKey, putKey, tx } from "./db";
import { VEHICLE_SEED_VERSION, seedVehicles } from "./seed";
import { assertCan, assertScope, getActor } from "./session";
import { supabase } from "./supabase";
import { beginSync, endSync, enqueueRetry } from "./sync-queue";
import { handoverBlockers, inRecon, releaseBlockers } from "./workflow";
import { normaliseReg, displayReg } from "./format";
import { newId } from "./collections";
import { missingDocuments, verifyDocument } from "./documents";
import { documentLabel, inferMakeFromModel } from "./masters";

/*
 * Browser-only stand-in for the vehicle API. Every mutation checks the caller's permission
 * and the business gate first (as the server will), so hiding a button is never the only guard.
 * Screens read through useVehicles(); no component touches IndexedDB directly.
 */

let cache: Vehicle[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function byNewest(a: Vehicle, b: Vehicle) {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Supabase `vehicles` table, when configured, holds one row per vehicle with the full
 * serialized record in a `data` jsonb column (id text primary key, data jsonb). If Supabase
 * isn't configured, the table doesn't exist yet, or it has no rows, this returns null and
 * the caller falls back to the existing local demo data so the list is never empty in preview.
 */
async function fetchFromSupabase(): Promise<Vehicle[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("vehicles").select("data");
    if (error) return null;
    if (!data || data.length === 0) {
      // Empty table (first run against a fresh project): seed it with the demo fleet
      // so the database is populated and stays the live source from here on.
      const seeds = seedVehicles();
      const { error: insertError } = await supabase.from("vehicles").insert(seeds.map((v) => ({ id: v.id, data: v })));
      if (insertError) return null;
      return seeds;
    }
    return data.map((row: { data: Vehicle }) => row.data);
  } catch {
    return null;
  }
}

function load() {
  loading ??= (async () => {
    const remote = await fetchFromSupabase();
    if (remote) {
      cache = remote.map((v) => (v.documents ? v : { ...v, documents: [] })).sort(byNewest);
      emit();
      return;
    }
    const rows = (await tx<Vehicle[]>("vehicles", "readonly", (s) => s.getAll())) ?? [];
    // Replace demo records when the demo seed changes; vehicles people added are kept.
    const version = await getKey<number>("vehicle-seed-version");
    let result = rows;
    if (version !== VEHICLE_SEED_VERSION) {
      const seeds = seedVehicles();
      const own = rows.filter((v) => !v.id.startsWith("seed-"));
      await tx("vehicles", "readwrite", (s) => {
        rows.filter((v) => v.id.startsWith("seed-")).forEach((v) => s.delete(v.id));
        seeds.forEach((v) => s.put(v));
      });
      await putKey("vehicle-seed-version", VEHICLE_SEED_VERSION);
      result = [...own, ...seeds];
    }
    // Records saved before the document vault existed have no `documents` field.
    cache = result.map((v) => (v.documents ? v : { ...v, documents: [] })).sort(byNewest);
    emit();
  })();
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVehicles() {
  const vehicles = useSyncExternalStore(subscribe, () => cache, () => null);
  useEffect(() => {
    load();
  }, []);
  return { vehicles: vehicles ?? [], ready: vehicles !== null };
}

export function useVehicle(id: string) {
  const { vehicles, ready } = useVehicles();
  return { vehicle: vehicles.find((v) => v.id === id), ready };
}

/**
 * Mirrors one vehicle's full record (photos, documents, pricing, branch, specs — everything)
 * into Supabase as a single jsonb payload, keeping the row a 1:1 copy of the local record.
 * Fired without blocking the caller so the optimistic local update never waits on the network.
 */
function syncToSupabase(vehicle: Vehicle) {
  if (!supabase) return;
  beginSync();
  supabase
    .from("vehicles")
    .upsert({ id: vehicle.id, data: vehicle })
    .then(({ error }) => {
      endSync();
      if (error) {
        console.error("Supabase sync failed:", error.message);
        enqueueRetry({ table: "vehicles", kind: "upsert", rows: [{ id: vehicle.id, data: vehicle }] });
      }
    });
}

async function update(id: string, change: (v: Vehicle) => Vehicle) {
  await load();
  const current = cache!.find((v) => v.id === id);
  if (!current) throw new Error("Vehicle not found");
  const updated = change(current);
  await tx("vehicles", "readwrite", (s) => s.put(updated));
  cache = cache!.map((v) => (v.id === id ? updated : v));
  emit();
  syncToSupabase(updated);
  return updated;
}

const nowIso = () => new Date().toISOString();
const signed = () => ({ at: nowIso(), by: getActor().name });

/** Move to `stage`, recording every stage passed through. */
function advance(v: Vehicle, stage: number, at = nowIso()): Pick<Vehicle, "stage" | "stageHistory"> {
  if (stage <= v.stage) return { stage: v.stage, stageHistory: v.stageHistory };
  const added = Array.from({ length: stage - v.stage }, (_, i) => ({ stage: v.stage + i + 1, at }));
  return { stage, stageHistory: [...v.stageHistory, ...added] };
}

function fail(message: string): never {
  throw new Error(message);
}

// ---- entry & verification ------------------------------------------------------

function nextProvisionalId(now: Date) {
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seq = cache!.reduce((max, v) => Math.max(max, Number(v.provisionalId.split("-")[2]) || 0), 0) + 1;
  return `PRV-${yymm}-${String(seq).padStart(4, "0")}`;
}

export async function createVehicle(input: NewVehicle): Promise<Vehicle> {
  assertCan("stock.create");
  assertScope(input.branchId);
  await load();
  const now = new Date();
  const vehicle: Vehicle = {
    ...input,
    enteredBy: getActor().name,
    id: crypto.randomUUID(),
    provisionalId: nextProvisionalId(now),
    createdAt: now.toISOString(),
    stage: 1,
    stageHistory: [{ stage: 1, at: now.toISOString() }],
    documents: [],
  };
  await tx("vehicles", "readwrite", (s) => s.put(vehicle));
  cache = [vehicle, ...cache!];
  emit();
  syncToSupabase(vehicle);
  return vehicle;
}

/** Permanently remove one vehicle record. Managing Partner only; every other role never sees the option. */
export async function deleteVehicle(id: string) {
  assertCan("stock.delete");
  await load();
  const v = cache!.find((x) => x.id === id);
  if (!v) fail("Vehicle not found");
  assertScope(v.branchId);
  if (supabase) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) fail(`Blocked: could not delete from the database — ${error.message}`);
  }
  await tx("vehicles", "readwrite", (s) => s.delete(id));
  cache = cache!.filter((x) => x.id !== id);
  emit();
}

/** Permanently remove several vehicle records in one transaction, e.g. from a bulk selection. */
export async function deleteVehicles(ids: string[]) {
  assertCan("stock.delete");
  if (!ids.length) return;
  await load();
  const targets = cache!.filter((v) => ids.includes(v.id));
  targets.forEach((v) => assertScope(v.branchId));
  if (supabase) {
    const { error } = await supabase.from("vehicles").delete().in("id", ids);
    if (error) fail(`Blocked: could not delete from the database — ${error.message}`);
  }
  await tx("vehicles", "readwrite", (s) => targets.forEach((v) => s.delete(v.id)));
  const removed = new Set(targets.map((v) => v.id));
  cache = cache!.filter((v) => !removed.has(v.id));
  emit();
}

export function setVerified(id: string, verified: boolean) {
  assertCan("stock.verify");
  return update(id, (v) => {
    assertScope(v.branchId);
    return {
      ...v,
      verified: verified ? signed() : undefined,
      ...(verified ? advance(v, 3) : {}),
      // Un-verifying invalidates an active "Ready for Sale" tag - it was only ever valid on a
      // verified vehicle. Leave a "Rejected Stock" tag alone; that flag doesn't depend on verification.
      saleReadiness: !verified && v.saleReadiness?.status === "ready_for_sale" ? undefined : v.saleReadiness,
    };
  });
}

/** Revoke verification - same as `setVerified(id, false)`, named for discoverability at unverify call sites. */
export function unverifyVehicle(id: string) {
  return setVerified(id, false);
}

/**
 * Manual sales-readiness tag: a quick override independent of `stage`, so a branch can flag
 * a bike as ready to sell (or reject it) without going through the recon/quality-gate
 * pipeline that separately governs when a vehicle can actually reach "On display".
 */
export function setSaleReadiness(id: string, status: SaleReadinessStatus, reason?: string) {
  assertCan("stock.verify");
  return update(id, (v) => {
    assertScope(v.branchId);
    if (v.sale) fail("Blocked: this vehicle is already sold or booked - its sale readiness can't be changed");
    if (inRecon(v)) fail("Blocked: this vehicle is actively in reconditioning - decide readiness once the job card is signed off");
    return { ...v, saleReadiness: { status, reason: reason?.trim() || undefined, ...signed() } };
  });
}

/**
 * "Send to Reconditioning" from the Rejected Stock tab: books the vehicle straight into the
 * same "Under reconditioning" stage `receiveVehicle` creates (advancing through any stages in
 * between), and clears the Rejected Stock tag - it's now on a real path forward instead of a
 * dead end. Refuses to clobber an existing job card, and refuses a vehicle already sold/booked.
 */
export function sendToReconditioning(id: string) {
  assertCan("stock.verify");
  return update(id, (v) => {
    assertScope(v.branchId);
    if (v.sale) fail("Blocked: this vehicle is already sold or booked");
    if (v.recon) fail("Already in reconditioning");
    const at = nowIso();
    return {
      ...v,
      ...advance(v, 8, at),
      recon: { supervisor: roleName("supervisor"), startedAt: at, items: [], photos: [], sendBacks: [] },
      saleReadiness: undefined,
    };
  });
}

// ---- purchase & seller payment ---------------------------------------------------

export function enterPurchase(id: string, deductionsPaise: number, deductionNote: string) {
  assertCan("purchase.enter");
  return update(id, (v) => {
    assertScope(v.branchId);
    if (!v.verified) fail("Blocked: vehicle not cross-verified yet");
    if (v.purchase && v.purchase.payout.status !== "requested") fail("Blocked: payout already approved; ask the central accountant to reverse it");
    if (deductionsPaise < 0 || deductionsPaise >= v.agreedValuePaise) fail("Deductions must be less than the agreed value");
    return {
      ...v,
      ...advance(v, 4),
      purchase: {
        deductionsPaise,
        deductionNote,
        netPayablePaise: v.agreedValuePaise - deductionsPaise,
        entered: signed(),
        payout: { status: "requested" },
      },
    };
  });
}

export function approvePayout(id: string) {
  assertCan("payout.approve");
  return update(id, (v) => {
    if (v.purchase?.payout.status !== "requested") fail("Blocked: no payout request to approve");
    return { ...v, purchase: { ...v.purchase, payout: { ...v.purchase.payout, status: "approved", approved: signed() } } };
  });
}

export async function markPayoutPaid(id: string, reference: string) {
  assertCan("payout.approve");
  const v = await update(id, (v) => {
    if (v.purchase?.payout.status !== "approved") fail("Blocked: payout must be approved before it is paid");
    if (!reference.trim()) fail("Enter the payment reference (UTR / cheque no.)");
    return { ...v, purchase: { ...v.purchase, payout: { ...v.purchase.payout, status: "paid", paid: signed(), reference: reference.trim() } } };
  });
  return v;
}

// ---- dispatch & receipt ----------------------------------------------------------

export async function dispatchVehicle(id: string, rider: string, notes?: string, to = "ang", from?: string) {
  assertCan("transit.dispatch");
  const v = await update(id, (v) => {
    assertScope(v.branchId);
    if (v.dispatch) fail("Already dispatched");
    if (!rider.trim()) fail("Enter the rider's name");
    const origin = from ?? v.branchId;
    if (to === origin) fail("Destination must be different from the origin");
    return {
      ...v,
      ...advance(v, 6),
      dispatch: { rider: rider.trim(), handoverAt: nowIso(), by: getActor().name, from: origin, to, notes: notes?.trim() || undefined, prevStage: v.stage },
    };
  });
  return v;
}

/**
 * The "remove" action on /transit and /receiving for a real inventory vehicle: undoes the
 * dispatch and its transport-cost posting, restoring the pre-dispatch stage, without touching
 * the vehicle record itself. (A quick/manual entry is deleted outright instead - see `deleteVehicle`.)
 */
export async function cancelDispatch(id: string) {
  assertCan("transit.dispatch");
  const v = await update(id, (v) => {
    assertScope(v.branchId);
    if (!v.dispatch) fail("Not dispatched");
    if (v.receipt) fail("Already received - can't cancel a completed transit");
    const { prevStage } = v.dispatch;
    return { ...v, dispatch: undefined, stage: prevStage, stageHistory: v.stageHistory.filter((e) => e.stage <= prevStage) };
  });
  return v;
}

/**
 * The manual "Add vehicle" form on /transit: matches an existing bike by registration number and
 * dispatches it as-is, or - for a quick/direct entry with no inventory match - registers a bare
 * stock record on the spot with just what the form captured, then dispatches that. Either way the
 * result is a normal dispatched vehicle, so the transit table, "Mark as received", SLA tracking
 * and badges need no special-casing for how the entry got there.
 */
export async function quickAddToTransit(input: { registrationNo: string; model: string; rider: string; from: string; to: string; notes?: string }) {
  await load();
  const reg = normaliseReg(input.registrationNo);
  if (!reg) fail("Enter the vehicle's registration number");
  const existing = cache!.find((v) => v.registrationNo === reg);
  const vehicle =
    existing ??
    (await createVehicle({
      enteredBy: getActor().name,
      quickEntry: true,
      source: "direct",
      branchId: input.from,
      registrationNo: reg,
      make: inferMakeFromModel(input.model),
      model: input.model.trim(),
      variant: "",
      year: new Date().getFullYear(),
      engineCc: 0,
      odometerKm: 0,
      colour: "",
      owners: 1,
      fuel: "petrol",
      chassisNo: "",
      engineNo: "",
      insurancePolicyNo: "",
      financeStatus: "free",
      conditionNotes: "Quick transit entry - full intake details pending.",
      accidentHistory: "none",
      knownDefects: "",
      agreedValuePaise: 0,
      seller: { name: "", phone: "" },
      photos: {},
    }));
  return dispatchVehicle(vehicle.id, input.rider, input.notes, input.to, input.from);
}

function nextStockId() {
  const max = cache!.reduce((m, v) => Math.max(m, Number(v.stockId?.slice(3)) || 0), 1040);
  return `TW-${String(max + 1).padStart(5, "0")}`;
}

/** Book an arriving vehicle into Angamaly stock. Refused if the plate doesn't match the dispatch record. */
export function receiveVehicle(id: string, regConfirmed: string, notes: string) {
  assertCan("hub.receive");
  return update(id, (v) => {
    if (!v.dispatch || v.receipt) fail("Blocked: vehicle is not in transit");
    const typed = normaliseReg(regConfirmed);
    if (typed !== v.registrationNo) fail(`Blocked: ${displayReg(typed) || "blank"} does not match the dispatch record (${displayReg(v.registrationNo)})`);
    const at = nowIso();
    return {
      ...v,
      ...advance(v, 8, at),
      stockId: nextStockId(),
      receipt: { at, by: getActor().name, regConfirmed: typed, notes: notes.trim() },
      // Auto-assigned to the Angamaly supervisor; the reconditioning clock starts now.
      recon: { supervisor: roleName("supervisor"), startedAt: at, items: [], photos: [], sendBacks: [] },
    };
  });
}

// ---- reconditioning --------------------------------------------------------------

function editRecon(id: string, change: (v: Vehicle, recon: NonNullable<Vehicle["recon"]>) => Partial<Vehicle>) {
  assertCan("recon.manage");
  return update(id, (v) => {
    if (!v.recon || v.gate || v.stage !== 8) fail("Blocked: vehicle is not in reconditioning");
    return { ...v, ...change(v, v.recon) };
  });
}

export function addJobItem(id: string, item: Omit<JobItem, "id">) {
  if (!item.description.trim() || item.costPaise <= 0) throw new Error("Enter a description and a cost");
  return editRecon(id, (_, r) => {
    if (r.completed) fail("Blocked: job card is signed off; wait for the manager's decision");
    return { recon: { ...r, items: [...r.items, { ...item, id: newId("ji") }] } };
  });
}

export function removeJobItem(id: string, itemId: string) {
  return editRecon(id, (_, r) => {
    if (r.completed) fail("Blocked: job card is signed off");
    return { recon: { ...r, items: r.items.filter((i) => i.id !== itemId) } };
  });
}

export function addReconPhoto(id: string, dataUrl: string) {
  return editRecon(id, (_, r) => ({ recon: { ...r, photos: [...r.photos, dataUrl] } }));
}

export function removeReconPhoto(id: string, index: number) {
  return editRecon(id, (_, r) => ({ recon: { ...r, photos: r.photos.filter((_, i) => i !== index) } }));
}

export function setProposedPrice(id: string, paise: number) {
  return editRecon(id, () => ({ proposedPricePaise: paise }));
}

export function setTechnician(id: string, name: string) {
  return editRecon(id, (_, r) => ({ recon: { ...r, technicianName: name.trim() || undefined } }));
}

export const MIN_COMPLETION_PHOTOS = 4;

/**
 * Supervisor sign-off. Signing off now returns the vehicle straight to general stock evaluation
 * instead of waiting on a separate quality-gate approval - Ready for Sale / Not Ready for Sale
 * is the decision point from here. The job card itself (items, photos, cost) is kept exactly as
 * it is - only `stage` reverts - so landed cost and margin still account for this recon cycle.
 */
export function completeRecon(id: string) {
  return editRecon(id, (v, r) => {
    if (r.completed) fail("Already signed off");
    if (r.photos.length < MIN_COMPLETION_PHOTOS) fail(`Blocked: add at least ${MIN_COMPLETION_PHOTOS} photos (four sides) before sign-off`);
    return { recon: { ...r, completed: signed() }, stage: 7, stageHistory: v.stageHistory.filter((e) => e.stage <= 7) };
  });
}

// ---- quality gate ----------------------------------------------------------------
//
// A completed job card no longer waits here - completeRecon() above returns the vehicle to
// general stock evaluation directly. These two actions still work on any vehicle that was
// already sitting at the gate (stage 8, completed, ungated) before that change.

export async function approveGate(id: string) {
  assertCan("gate.approve");
  const v = await update(id, (v) => {
    if (!v.recon?.completed) fail("Blocked: supervisor has not signed off the job card");
    if (v.gate) fail("Already approved");
    if (v.stage !== 8) fail("Blocked: this vehicle has already returned to general stock evaluation");
    if (!v.verified) fail("Blocked: documents not verified");
    // Hard lock: every mandatory document (RC, insurance, forms, KYC, purchase receipt) must be
    // uploaded and verified, and not expired, before the vehicle can go "On display".
    const missing = missingDocuments(v);
    if (missing.length) fail(`Blocked: missing or unverified documents — ${missing.map(documentLabel).join(", ")}`);
    const at = nowIso();
    return { ...v, ...advance(v, 10, at), gate: { at, by: getActor().name } };
  });
  return v;
}

export function sendBackToRecon(id: string, reason: string) {
  assertCan("gate.approve");
  return update(id, (v) => {
    if (!v.recon?.completed || v.gate || v.stage !== 8) fail("Blocked: nothing waiting at the quality gate");
    if (!reason.trim()) fail("Give a reason for sending it back");
    return { ...v, recon: { ...v.recon, completed: undefined, sendBacks: [...v.recon.sendBacks, { ...signed(), reason: reason.trim() }] } };
  });
}

// ---- sale ------------------------------------------------------------------------

const SOLD_STAGE = 11;

function enterSoldStage(v: Vehicle, at: string): Pick<Vehicle, "stage" | "stageHistory"> {
  if (v.stage === SOLD_STAGE) return { stage: v.stage, stageHistory: v.stageHistory };
  return { stage: SOLD_STAGE, stageHistory: [...v.stageHistory, { stage: SOLD_STAGE, at }] };
}

export async function bookVehicle(id: string, customer: Customer, bookingAmountPaise: number) {
  assertCan("sale.book");
  const v = await update(id, (v) => {
    if (v.saleReadiness?.status !== "ready_for_sale") fail("Only vehicles marked Ready for Sale can be booked");
    if (v.sale) fail(`Already ${v.sale.status}`);
    const at = nowIso();
    return {
      ...v,
      ...enterSoldStage(v, at),
      sale: { status: "booked", customer, bookedAt: at, bookingAmountPaise, by: getActor().name, prevStage: v.stage },
    };
  });
  return v;
}

export async function sellVehicle(id: string, customer: Customer, salePricePaise: number) {
  assertCan("sale.book");
  const v = await update(id, (v) => {
    // Only gates a *new* sale - a booking already in progress can still be completed even if
    // the vehicle's readiness tag changes afterward.
    if (!v.sale && v.saleReadiness?.status !== "ready_for_sale") fail("Only vehicles marked Ready for Sale can be sold");
    if (v.sale?.status === "sold") fail("Already sold");
    const at = nowIso();
    return {
      ...v,
      ...enterSoldStage(v, at),
      sale: { ...v.sale, status: "sold", customer, soldAt: at, salePricePaise, by: getActor().name, prevStage: v.sale?.prevStage ?? v.stage },
      delivery: v.delivery ?? { transfer: {} },
    };
  });
  return v;
}

/** Accounts: records how a sold vehicle's payment has come in so far - mode and running total collected. */
export function recordPayment(id: string, paymentMode: PaymentMode, receivedAmountPaise: number) {
  assertCan("accounts.manage");
  return update(id, (v) => {
    if (v.sale?.status !== "sold") fail("Blocked: this vehicle hasn't been sold yet");
    if (receivedAmountPaise < 0) fail("Enter a valid amount");
    return { ...v, sale: { ...v.sale, paymentMode, receivedAmountPaise } };
  });
}

export async function cancelBooking(id: string) {
  assertCan("sale.book");
  const v = await update(id, (v) => {
    if (v.sale?.status !== "booked") fail("Only a booking can be cancelled");
    const { prevStage } = v.sale;
    return { ...v, sale: undefined, stage: prevStage, stageHistory: v.stageHistory.filter((e) => e.stage <= prevStage) };
  });
  return v;
}

export function verifySaleDocs(id: string) {
  assertCan("sale.docs");
  return update(id, (v) => {
    if (!v.sale) fail("Blocked: no booking on this vehicle");
    return { ...v, sale: { ...v.sale, docsVerified: signed() } };
  });
}

// ---- ownership transfer & delivery -------------------------------------------------

export function setTransferStep(id: string, step: TransferStep, done: boolean) {
  assertCan("delivery.transfer");
  return update(id, (v) => {
    if (v.sale?.status !== "sold") fail("Blocked: record the sale first");
    if (v.delivery?.released) fail("Blocked: already released; the checklist is locked");
    const transfer = { ...v.delivery?.transfer };
    if (done) transfer[step] = signed();
    else delete transfer[step];
    return { ...v, delivery: { ...v.delivery, transfer } };
  });
}

export function requestTransferFee(id: string, feePaise: number) {
  assertCan("delivery.transfer");
  return update(id, (v) => {
    if (v.sale?.status !== "sold") fail("Blocked: record the sale first");
    if (feePaise <= 0) fail("Enter the fee amount");
    if (v.delivery?.feePayment && v.delivery.feePayment.status !== "requested") fail("Blocked: fee already approved");
    return { ...v, delivery: { transfer: {}, ...v.delivery, transferFeePaise: feePaise, feePayment: { status: "requested", requested: signed() } } };
  });
}

export function approveTransferFee(id: string) {
  assertCan("fees.manage");
  return update(id, (v) => {
    const fee = v.delivery?.feePayment;
    if (fee?.status !== "requested") fail("Blocked: no fee request to approve");
    return { ...v, delivery: { ...v.delivery!, feePayment: { ...fee, status: "approved", approved: signed() } } };
  });
}

export async function payTransferFee(id: string) {
  assertCan("fees.manage");
  const v = await update(id, (v) => {
    const fee = v.delivery?.feePayment;
    if (fee?.status !== "approved") fail("Blocked: approve the fee before paying it");
    const s = signed();
    return { ...v, delivery: { ...v.delivery!, feePayment: { ...fee, status: "paid", paid: s }, transfer: { ...v.delivery!.transfer, fee: v.delivery!.transfer.fee ?? s } } };
  });
  return v;
}

/** Manager's final release. HARD LOCK: refused unless the ownership transfer is fully confirmed. */
export function releaseDelivery(id: string) {
  assertCan("delivery.release");
  return update(id, (v) => {
    const blockers = releaseBlockers(v);
    if (blockers.length) fail(`Blocked: ${blockers.join(". ")}`);
    return { ...v, delivery: { ...v.delivery!, released: signed() } };
  });
}

export function recordHandover(id: string) {
  assertCan("delivery.handover");
  return update(id, (v) => {
    const blockers = handoverBlockers(v);
    if (blockers.length) fail(`Blocked: ${blockers.join(". ")}`);
    const s = signed();
    return { ...v, ...advance(v, 12, s.at), delivery: { ...v.delivery!, delivered: s } };
  });
}

// ---- document vault ---------------------------------------------------------------

/** Add or replace a document. Any document missing `uploadedBy` is stamped with the current actor. */
export function updateDocuments(id: string, documents: Document[]) {
  assertCan("stock.verify");
  const actor = getActor().name;
  return update(id, (v) => {
    assertScope(v.branchId);
    return { ...v, documents: documents.map((d) => (d.uploadedBy ? d : { ...d, uploadedBy: actor })) };
  });
}

/** Verify a single document. */
export function verifyDocumentRecord(id: string, docId: string) {
  assertCan("stock.verify");
  return update(id, (v) => {
    assertScope(v.branchId);
    const doc = v.documents.find((d) => d.id === docId);
    if (!doc) fail("Document not found");
    const verified = verifyDocument(doc, getActor().name);
    return { ...v, documents: v.documents.map((d) => (d.id === docId ? verified : d)) };
  });
}

/** Remove one uploaded document. Managing Partner only; other roles keep upload/verify via stock.verify. */
export function deleteDocumentRecord(id: string, docId: string) {
  assertCan("documents.delete");
  return update(id, (v) => {
    assertScope(v.branchId);
    return { ...v, documents: v.documents.filter((d) => d.id !== docId) };
  });
}
