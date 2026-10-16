import { DOCUMENT_TYPES, PHOTO_SLOTS, branchName, documentLabel } from "./masters";
import { formatDateTime, formatNumber, formatPaise, formatPhone, displayReg } from "./format";
import { inRecon, inTransit } from "./workflow";
import type { DocumentStatus, Vehicle } from "./types";

/*
 * Stock Deck: every vehicle as a playing card. A card's back is themed by where the vehicle is in
 * its life, derived here from the same fields the rest of the app uses.
 */

export type DeckStatus = "verification_pending" | "in_stock" | "in_transit" | "receiving" | "reconditioning" | "evaluation" | "ready_for_sale" | "rejected" | "sold";

export interface DeckTheme {
  label: string;
  /** The status colour at its most vivid (chips, dots), a light tint of it for glows and highlights, then the card body's gradient from top (bg1) to bottom (bg2). White type sits on the body, so the shades are chosen to keep it readable. */
  accent: string;
  accent2: string;
  bg1: string;
  bg2: string;
}

export const DECK_THEMES: Record<DeckStatus, DeckTheme> = {
  verification_pending: { label: "Verification pending", accent: "#d97706", accent2: "#fde68a", bg1: "#c9660a", bg2: "#9a4509" },
  in_stock: { label: "Verified · at branch", accent: "#2563eb", accent2: "#bfdbfe", bg1: "#2563eb", bg2: "#1d4ed8" },
  in_transit: { label: "In transit", accent: "#0891b2", accent2: "#a5f3fc", bg1: "#0b86a8", bg2: "#075985" },
  receiving: { label: "Receiving", accent: "#4f46e5", accent2: "#c7d2fe", bg1: "#4f46e5", bg2: "#4338ca" },
  reconditioning: { label: "In reconditioning", accent: "#7c3aed", accent2: "#ddd6fe", bg1: "#7c3aed", bg2: "#6d28d9" },
  evaluation: { label: "Sale review", accent: "#ea580c", accent2: "#fed7aa", bg1: "#dc4f0b", bg2: "#b53a0a" },
  ready_for_sale: { label: "Ready for sale", accent: "#059669", accent2: "#a7f3d0", bg1: "#059669", bg2: "#047857" },
  rejected: { label: "Rejected stock", accent: "#475569", accent2: "#cbd5e1", bg1: "#475569", bg2: "#334155" },
  sold: { label: "Booked / sold", accent: "#dc2626", accent2: "#fecaca", bg1: "#dc2626", bg2: "#b91c1c" },
};

/** Display order for the filter chips (roughly the vehicle's journey). */
export const DECK_STATUS_ORDER: DeckStatus[] = ["verification_pending", "in_stock", "in_transit", "receiving", "reconditioning", "evaluation", "ready_for_sale", "rejected", "sold"];

/**
 * Where a vehicle is right now. "Receiving" is a vehicle that has been received at the hub but
 * whose workshop job card hasn't been started yet (no technician, items, photos or dates);
 * once any of that exists it counts as "In reconditioning".
 */
export function deckStatus(v: Vehicle): DeckStatus {
  if (v.sale) return "sold";
  if (v.saleReadiness?.status === "ready_for_sale" || v.gate) return "ready_for_sale";
  if (v.saleReadiness?.status === "rejected_stock") return "rejected";
  if (inTransit(v)) return "in_transit";
  if (inRecon(v)) {
    const r = v.recon!;
    const started = !!(r.technicianName || r.reconStartDate || r.items.length || r.photos.length);
    return started ? "reconditioning" : "receiving";
  }
  if (!v.dispatch && !v.verified) return "verification_pending";
  if (!v.dispatch) return "in_stock";
  return "evaluation";
}

/** The badge text: the theme's label, except sold vehicles say which of Booked / Sold / Delivered. */
export function deckStatusLabel(v: Vehicle, status: DeckStatus): string {
  if (status === "sold") return v.delivery?.delivered ? "Delivered" : v.sale?.status === "booked" ? "Booked" : "Sold";
  return DECK_THEMES[status].label;
}

export const SUITS = [
  { char: "♠", red: false },
  { char: "♥", red: true },
  { char: "♣", red: false },
  { char: "♦", red: true },
] as const;

/** A stable suit per vehicle, so a card keeps its suit between visits. */
export function suitFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SUITS[h % SUITS.length];
}

export function rankFor(v: Vehicle) {
  return (v.make.trim()[0] ?? "A").toUpperCase();
}

// ---- dossier ------------------------------------------------------------------------

export interface DossierFile {
  kind: "photo" | "document";
  group: string;
  label: string;
  /** Absent on a document record that has no file attached yet (shown, but nothing to download). */
  url?: string;
  /** File name (without folder) to save as. Extension is added from the file's type when missing. */
  base: string;
  status?: DocumentStatus;
  expiresAt?: string;
}

/** Every photo and document on a vehicle: intake photos, reconditioning photos, and the latest upload of each document type. */
export function dossierFiles(v: Vehicle): DossierFile[] {
  const files: DossierFile[] = [];
  for (const p of PHOTO_SLOTS) {
    const url = v.photos[p.slot];
    if (url) files.push({ kind: "photo", group: "Intake photos", label: p.label, url, base: `Intake - ${p.label}` });
  }
  (v.recon?.photos ?? []).forEach((url, i) => files.push({ kind: "photo", group: "Reconditioning photos", label: `Recon photo ${i + 1}`, url, base: `Recon photo ${i + 1}` }));

  // Latest upload per type: known types in their usual order first, then any other type on record (e.g. retired ones).
  const latest = new Map<string, Vehicle["documents"][number]>();
  for (const d of v.documents) {
    const prev = latest.get(d.type);
    if (!prev || (d.uploadedAt ?? "") >= (prev.uploadedAt ?? "")) latest.set(d.type, d);
  }
  const known = DOCUMENT_TYPES.map((t) => t.type as string);
  const order = [...known.filter((t) => latest.has(t)), ...[...latest.keys()].filter((t) => !known.includes(t))];
  for (const type of order) {
    const d = latest.get(type)!;
    files.push({
      kind: "document",
      group: "Documents",
      label: documentLabel(d.type),
      url: d.fileUrl,
      base: documentLabel(d.type),
      status: d.status,
      expiresAt: d.expiresAt,
    });
  }
  return files;
}

// ---- readable details -----------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 2021" when the manufacture month is on record, otherwise just "2021". */
export function mfgLabel(v: Vehicle) {
  return v.month && v.month >= 1 && v.month <= 12 ? `${MONTHS[v.month - 1]} ${v.year}` : String(v.year);
}

export interface DossierSection {
  title: string;
  rows: [label: string, value: string][];
}

const yesNo = (x?: string) => (x === "yes" ? "Yes" : x === "no" ? "No" : "—");

/** A vehicle's details A to Z as labelled rows, grouped. Rows that only apply sometimes (finance, dispatch, sale...) appear only when they do. */
export function dossierSections(v: Vehicle): DossierSection[] {
  const status = deckStatus(v);
  const ev = v.fuel === "electric";
  const vehicle: DossierSection = {
    title: "Vehicle",
    rows: [
      ["Status", deckStatusLabel(v, status)],
      ["Stock ID", v.stockId || `${v.provisionalId} (provisional)`],
      ["Registration", displayReg(v.registrationNo) || "—"],
      ["Vehicle", [v.make, v.model, v.variant].filter(Boolean).join(" ")],
      ["Manufactured", mfgLabel(v)],
      ["Fuel", ev ? "Electric" : "Petrol"],
      [ev ? "Motor" : "Engine", v.engineCc ? `${v.engineCc} ${ev ? "W" : "cc"}` : "—"],
      ["Odometer", v.odometerKm ? `${formatNumber(v.odometerKm)} km` : "—"],
      ["Colour", v.colour || "—"],
      ["Owners", String(v.owners)],
      ["Chassis no.", v.chassisNo || "—"],
      ["Engine no.", v.engineNo || "—"],
      ["Branch", branchName(v.branchId)],
      ["Stock added", formatDateTime(v.createdAt)],
      ["Entered by", v.enteredBy],
    ],
  };

  const purchase: DossierSection = {
    title: "Purchase & seller",
    rows: [
      ["Purchased value", formatPaise(v.agreedValuePaise)],
      ["Seller", v.seller.name || "—"],
      ["Seller mobile", v.seller.phone ? formatPhone(v.seller.phone) : "—"],
      ["Alternate mobile", v.seller.phoneAlt ? formatPhone(v.seller.phoneAlt) : "—"],
      ["Finance", v.financeStatus === "financed" ? "Under finance" : "Free (no loan)"],
      ...(v.financeStatus === "financed"
        ? ([
            ["Financier", v.financier || "—"],
            ["NOC", v.nocStatus === "received" ? "Received" : "Pending"],
            ["NOC seal", yesNo(v.nocSeal)],
            ["NOC sign", yesNo(v.nocSign)],
          ] as [string, string][])
        : []),
      ["Insurance", v.hasInsurance === "yes" ? `Yes${v.insuranceValidTill ? ` · valid till ${v.insuranceValidTill.split("-").reverse().join("/")}` : ""}` : yesNo(v.hasInsurance)],
      [
        "Challan",
        v.hasChallan === "yes" ? `Pending ${formatPaise(v.challanAmountPaise ?? 0)} · amount ${v.challanReceived === "yes" ? "received" : "not received"}` : v.hasChallan === "no" ? "None" : "—",
      ],
      ["RC / KYC mismatch", v.rcKycMismatch === "yes" ? `Yes${v.mismatchRemarks ? ` · ${v.mismatchRemarks}` : ""}` : yesNo(v.rcKycMismatch)],
      ["RC phone working", v.rcPhoneWorking === "no" ? `No${v.rcCurrentPhone ? ` · now ${formatPhone(v.rcCurrentPhone)}` : ""}` : yesNo(v.rcPhoneWorking)],
    ],
  };

  const condition: DossierSection = {
    title: "Condition",
    rows: [
      ["Front tyre", v.frontTyrePercent != null ? `${v.frontTyrePercent}%` : "—"],
      ["Rear tyre", v.rearTyrePercent != null ? `${v.rearTyrePercent}%` : "—"],
      ["Battery", v.batteryStatus === "not_good" ? "Bad" : v.batteryStatus ? "Good" : "—"],
      ["Condition notes", v.conditionNotes || "—"],
      ["Known defects", v.knownDefects || "—"],
    ],
  };

  const journey: DossierSection = { title: "Journey", rows: [] };
  const d = v.dispatch;
  if (d) {
    journey.rows.push(["Dispatched", `${formatDateTime(d.handoverAt)} · ${branchName(d.from)} → ${branchName(d.to)}`]);
    journey.rows.push(["Rider", `${d.rider}${d.riderPhone ? ` · ${formatPhone(d.riderPhone)}` : ""}`]);
    if (d.handoverDocs?.length) journey.rows.push(["Handed over", d.handoverDocs.join(", ")]);
  }
  if (v.receipt) journey.rows.push(["Received", `${formatDateTime(v.receipt.at)} · by ${v.receipt.by}`]);
  if (v.recon) {
    journey.rows.push(["Reconditioning", [v.recon.technicianName && `Technician ${v.recon.technicianName}`, v.recon.serviceAdvisor && `Advisor ${v.recon.serviceAdvisor}`, v.recon.completed ? "signed off" : "in progress"].filter(Boolean).join(" · ")]);
  }
  if (v.sale) {
    const sold = v.sale.status === "sold";
    journey.rows.push(["Sale", `${v.delivery?.delivered ? "Delivered" : sold ? "Sold" : "Booked"}${v.sale.salePricePaise != null ? ` · ${formatPaise(v.sale.salePricePaise)}` : ""}`]);
  }

  return [vehicle, purchase, condition, ...(journey.rows.length ? [journey] : [])];
}
