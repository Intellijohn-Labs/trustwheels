import type { PhotoSlot, DocumentType, SaleReadinessStatus } from "./types";
import { branchOverride } from "./branch-names";

// Placeholder masters. These become admin-editable masters (Module 16) served by the API.

const DEFAULT_BRANCHES = [
  { id: "b1", name: "Kothamangalam" },
  { id: "b2", name: "Perumbavoor" },
  { id: "b3", name: "Branch 3" },
  { id: "b4", name: "Branch 4" },
  { id: "b5", name: "Branch 5" },
  { id: "ang", name: "Angamaly Hub" },
] as const;

export type BranchId = (typeof DEFAULT_BRANCHES)[number]["id"];

/** Branch list; `name` reflects any rename made in Settings → Branches. */
export const BRANCHES = DEFAULT_BRANCHES.map((b) => ({
  id: b.id as BranchId,
  defaultName: b.name as string,
  get name() {
    return branchOverride(b.id) ?? b.name;
  },
}));

export const MAKES: Record<string, string[]> = {
  Honda: ["Activa 6G", "Shine", "Unicorn", "Dio", "SP 125"],
  Hero: ["Splendor Plus", "Passion Pro", "Glamour", "Xtreme 160R", "Destini 125"],
  TVS: ["Jupiter", "Apache RTR 160", "NTorq 125", "Raider 125", "XL100"],
  Bajaj: ["Pulsar 150", "Pulsar NS200", "Platina", "Avenger 220", "CT 110"],
  Yamaha: ["FZ-S", "R15 V4", "MT-15", "Fascino 125", "Ray ZR"],
  Suzuki: ["Access 125", "Gixxer", "Burgman Street"],
  "Royal Enfield": ["Classic 350", "Bullet 350", "Hunter 350", "Meteor 350"],
  KTM: ["Duke 200", "Duke 390", "RC 200"],
  Ather: ["450X", "Rizta"],
  Ola: ["S1 Pro", "S1 Air"],
};

export const COLOURS = ["Black", "White", "Red", "Blue", "Grey", "Silver", "Green", "Yellow", "Brown", "Other"];

/** Best-effort make lookup from a bare model name (e.g. "Splendor" -> "Hero"), for quick manual entries that only capture the model. */
export function inferMakeFromModel(model: string): string {
  const q = model.trim().toLowerCase();
  if (!q) return "";
  for (const [make, models] of Object.entries(MAKES)) {
    if (models.some((m) => m.toLowerCase().includes(q) || q.includes(m.toLowerCase()))) return make;
  }
  return "";
}

export const PHOTO_SLOTS: { slot: PhotoSlot; label: string; hint: string }[] = [
  { slot: "front", label: "Front", hint: "Full front view" },
  { slot: "rear", label: "Rear", hint: "Full rear with number plate" },
  { slot: "left", label: "Left side", hint: "Full left profile" },
  { slot: "right", label: "Right side", hint: "Full right profile" },
  { slot: "odometer", label: "Odometer", hint: "Close-up, reading visible" },
  { slot: "chassis", label: "Chassis vs RC", hint: "Chassis no. next to the RC" },
];

/** Document types required for vehicle acquisition. */
export const DOCUMENT_TYPES: { type: DocumentType; label: string; required: boolean; hasExpiry: boolean }[] = [
  { type: "rc_book", label: "RC Book", required: true, hasExpiry: false },
  { type: "insurance", label: "Insurance Certificate", required: true, hasExpiry: true },
  { type: "finance_noc", label: "Finance NOC", required: false, hasExpiry: true },
  { type: "forms_2829", label: "Forms 28/29/30", required: true, hasExpiry: false },
  { type: "seller_kyc", label: "Seller KYC", required: true, hasExpiry: false },
  { type: "purchase_receipt", label: "Purchase Receipt", required: true, hasExpiry: false },
];

export function documentLabel(type: DocumentType) {
  return DOCUMENT_TYPES.find((d) => d.type === type)?.label ?? type;
}

export function isDocumentRequired(type: DocumentType) {
  return DOCUMENT_TYPES.find((d) => d.type === type)?.required ?? false;
}

export const SALE_READINESS_LABEL: Record<SaleReadinessStatus, string> = {
  ready_for_sale: "Ready for Sale",
  rejected_stock: "Rejected Stock",
};

export const LIFECYCLE_STAGES = [
  "Entered",
  "Documents attached",
  "Cross-verified",
  "Acquisition recorded",
  "Dispatched",
  "In transit",
  "Received at Angamaly",
  "Under reconditioning",
  "Manager approved",
  "On display",
  "Sold / Booked",
  "Delivered",
];

// Time limits and thresholds. These become admin-editable settings (Module 16).
export const SLA = {
  verifyHours: 48, // vehicle must be verified within this after entry
  transitHours: 48, // dispatch -> received at Angamaly
  reconAmberHours: 48, // reconditioning RED flag, first level
  reconRedHours: 72, // reconditioning RED flag, second level
  codeRedDays: 4, // sale -> delivery
  sellerPaymentWorkingDays: 7, // cross-verification -> seller paid
  followUpDays: [2, 3, 4] as const, // enquiry follow-up calls
  inboundCallbackMinutes: 30, // a new incoming call must be called back within this
  noAnswerRetryMinutes: 120, // after "no answer / busy" on an incoming call, redial within this
};

export const VERIFY_LIMIT_HOURS = SLA.verifyHours;

/** Public holidays excluded from working-day counts (Sundays are always excluded). */
export const HOLIDAYS = ["2026-10-02", "2026-10-20", "2026-11-01", "2026-12-25", "2027-01-01", "2027-01-26"];

/** Ownership transfer checklist. Every step must be done before a delivery can be released. */
export const TRANSFER_STEPS = [
  { id: "forms", label: "Form 29 & 30 signed by seller and buyer" },
  { id: "rto", label: "Transfer application submitted at RTO" },
  { id: "fee", label: "Transfer fee paid" },
  { id: "rc", label: "New RC issued in buyer's name" },
  { id: "insurance", label: "Insurance transferred to buyer" },
] as const;

export type TransferStep = (typeof TRANSFER_STEPS)[number]["id"];

export function branchName(id: string) {
  return BRANCHES.find((b) => b.id === id)?.name ?? id;
}
