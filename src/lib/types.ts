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
}

export type NewVehicle = Omit<Vehicle, "id" | "provisionalId" | "createdAt" | "stage" | "stageHistory" | "stockId" | "verified" | "sale" | "documents">;
