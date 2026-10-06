import type { TransferStep } from "./masters";

export type Source = "exchange" | "direct";
export type Fuel = "petrol" | "electric";
export type FinanceStatus = "free" | "financed";
export type NocStatus = "pending" | "received";
export type AccidentHistory = "none" | "minor" | "major";

export type PhotoSlot = "front" | "rear" | "left" | "right" | "odometer" | "chassis";
export type DocumentType = "rc_book" | "insurance" | "finance_noc" | "forms_2829" | "seller_kyc" | "purchase_receipt";
export type DocumentStatus = "received" | "pending" | "verified" | "expired";

export interface Document {
  id: string; // unique document instance ID
  type: DocumentType;
  status: DocumentStatus;
  fileUrl?: string; // local data URL until file service exists
  fileName?: string;
  uploadedAt?: string; // ISO timestamp
  uploadedBy?: string;
  verifiedAt?: string; // ISO timestamp
  verifiedBy?: string; // reviewer name
  expiresAt?: string; // YYYY-MM-DD for insurance, finance NOC etc.
  notes?: string;
}

export interface StageEvent {
  stage: number;
  at: string; // ISO timestamp
}

export interface Vehicle {
  id: string;
  provisionalId: string;
  stockId?: string;
  createdAt: string;
  enteredBy: string;
  stage: number;
  stageHistory: StageEvent[];

  source: Source;
  branchId: string;

  registrationNo: string; // normalised, e.g. KL07AB1234
  make: string;
  model: string;
  variant: string;
  year: number;
  engineCc: number;
  odometerKm: number;
  colour: string;
  owners: number;
  fuel: Fuel;
  chassisNo: string;
  engineNo: string;

  insuranceValidTill?: string; // YYYY-MM-DD
  insurancePolicyNo: string;
  financeStatus: FinanceStatus;
  financier?: string;
  nocStatus?: NocStatus;

  conditionNotes: string;
  accidentHistory: AccidentHistory;
  knownDefects: string;

  agreedValuePaise: number;
  seller: { name: string; phone: string };

  photos: Partial<Record<PhotoSlot, string>>; // data URLs until the file service exists
  documents: Document[]; // RC, insurance, NOC, forms, KYC, purchase receipt

  verified?: { by: string; at: string };
  sale?: Sale;
  /** Manual sales-readiness tag, independent of `stage` - a quick override for "can this go out the door", separate from the recon/quality-gate pipeline that already governs `stage`. */
  saleReadiness?: SaleReadiness;
  /** Set only by the /transit "Add vehicle" quick entry when no inventory match was found - a bare placeholder record, not a real intake. Removing it from transit deletes it outright rather than just cancelling the dispatch. */
  quickEntry?: true;

  // Workflow after entry. Each is set by the role that owns that step.
  purchase?: Purchase; // branch accountant -> central accountant
  dispatch?: Dispatch; // branch manager
  receipt?: Receipt; // Angamaly administration
  recon?: Recon; // supervisor
  gate?: Signed; // Angamaly manager quality gate
  proposedPricePaise?: number;
  delivery?: Delivery; // sales executive + manager final release
}

export interface Signed {
  at: string;
  by: string;
}

export type SaleReadinessStatus = "ready_for_sale" | "rejected_stock";

export interface SaleReadiness {
  status: SaleReadinessStatus;
  reason?: string; // set when status is "rejected_stock"; optional
  at: string;
  by: string;
}

export interface Purchase {
  deductionsPaise: number;
  deductionNote: string;
  netPayablePaise: number;
  entered: Signed;
  payout: { status: "requested" | "approved" | "paid"; approved?: Signed; paid?: Signed; reference?: string };
}

export interface Dispatch {
  rider: string;
  handoverAt: string;
  by: string;
  /** Origin branch for this leg - usually `branchId`, but independently settable from the manual /transit form. */
  from: string;
  /** Destination branch for this leg - the Angamaly hub by default, but any other branch can be chosen. */
  to: string;
  notes?: string;
  /** Stage the vehicle was at right before this dispatch, restored if the dispatch is cancelled. */
  prevStage: number;
}

export interface Receipt extends Signed {
  regConfirmed: string;
  notes: string;
}

export type JobKind = "part" | "labour" | "vendor";

export interface JobItem {
  id: string;
  kind: JobKind;
  description: string;
  costPaise: number;
}

export interface Recon {
  supervisor: string;
  /** Individual mechanic doing the work on this vehicle - distinct from `supervisor`, the fixed role holder who manages the workshop. */
  technicianName?: string;
  startedAt: string;
  items: JobItem[];
  photos: string[];
  completed?: Signed;
  sendBacks: (Signed & { reason: string })[];
}

export interface Delivery {
  transfer: Partial<Record<TransferStep, Signed>>;
  transferFeePaise?: number;
  feePayment?: { status: "requested" | "approved" | "paid"; requested: Signed; approved?: Signed; paid?: Signed };
  released?: Signed;
  delivered?: Signed;
}

export type SaleStatus = "booked" | "sold";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "finance";

export interface Customer {
  name: string;
  phone: string;
}

export interface Sale {
  status: SaleStatus;
  customer: Customer;
  bookedAt?: string;
  bookingAmountPaise?: number;
  soldAt?: string;
  salePricePaise?: number;
  by: string;
  prevStage: number; // restored if a booking is cancelled
  docsVerified?: Signed; // buyer KYC and booking documents signed off by sales
  paymentMode?: PaymentMode;
  /** Total collected from the customer to date (booking token + anything since) - distinct from bookingAmountPaise, which is just the initial token. */
  receivedAmountPaise?: number;
}

/**
 * `documents` is optional here (and defaults to `[]` in createVehicle) rather than omitted
 * entirely - intake attaches documents already uploaded to the bucket (so already have a real,
 * final `fileUrl`) in the same create call, instead of a second update() right after. Two writes
 * to a brand-new row race on arrival order; if the plain create (with no documents) happened to
 * land at Supabase after the one attaching them, it would silently wipe them out again.
 */
export type NewVehicle = Omit<Vehicle, "id" | "provisionalId" | "createdAt" | "stage" | "stageHistory" | "stockId" | "verified" | "sale" | "documents"> & {
  documents?: Document[];
};
