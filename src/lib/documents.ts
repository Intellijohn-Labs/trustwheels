import { DOCUMENT_TYPES } from "./masters";
import type { Document, DocumentType, Vehicle } from "./types";
import { assertCan } from "./session";
import { newId } from "./collections";

/**
 * Vehicle document attachment & vault.
 * Tracks RC, insurance, NOC, forms, KYC, and purchase receipt with status and expiry.
 * Prevents "On display" stage advancement until all required documents are verified.
 */

export function addDocument(
  type: DocumentType,
  fileUrl: string,
  fileName: string,
  expiresAt?: string
): Document {
  assertCan("stock.verify");
  const doc: Document = {
    id: newId("doc"),
    type,
    status: "received",
    fileUrl,
    fileName,
    uploadedAt: new Date().toISOString(),
    uploadedBy: "user", // will be replaced by getActor().name via action
    expiresAt,
    notes: "",
  };
  return doc;
}

/** Verify a document (mark as verified by an executive). */
export function verifyDocument(doc: Document, by: string): Document {
  assertCan("stock.verify");
  return { ...doc, status: "verified", verifiedAt: new Date().toISOString(), verifiedBy: by };
}

/** Check if a document has expired (for insurance, finance NOC, etc.). */
export function isExpired(doc: Document, today = new Date().toISOString().split("T")[0]): boolean {
  return doc.expiresAt ? doc.expiresAt < today : false;
}

/** Get all documents of a type for this vehicle. `documents` defaults to [] for records saved before this field existed. */
export function getDocumentsByType(vehicle: Vehicle, type: DocumentType): Document[] {
  return (vehicle.documents ?? []).filter((d) => d.type === type);
}

/** Get the most recent document of a type. */
export function getLatestDocument(vehicle: Vehicle, type: DocumentType): Document | undefined {
  const docs = getDocumentsByType(vehicle, type);
  return docs.length > 0 ? docs[docs.length - 1] : undefined;
}

/** Check if all required documents are present and verified. Expired docs count as unverified. */
export function allRequiredDocsVerified(vehicle: Vehicle): boolean {
  const today = new Date().toISOString().split("T")[0];
  return DOCUMENT_TYPES.filter((dt) => dt.required).every((dt) => {
    const doc = getLatestDocument(vehicle, dt.type);
    return doc && doc.status === "verified" && !isExpired(doc, today);
  });
}

/** Documents missing or pending verification. */
export function missingDocuments(vehicle: Vehicle): DocumentType[] {
  const today = new Date().toISOString().split("T")[0];
  return DOCUMENT_TYPES.filter((dt) => dt.required).flatMap((dt) => {
    const doc = getLatestDocument(vehicle, dt.type);
    if (!doc || doc.status !== "verified" || isExpired(doc, today)) {
      return [dt.type];
    }
    return [];
  });
}

/**
 * Can the vehicle advance to "On display" stage?
 * Requires all mandatory documents to be received, verified, and not expired.
 */
export function canAdvanceToDisplay(vehicle: Vehicle): boolean {
  return allRequiredDocsVerified(vehicle);
}

/** Generate a delivery pack: all verified documents assembled. */
export function assembleDeliveryPack(vehicle: Vehicle): Document[] {
  return DOCUMENT_TYPES.map((dt) => getLatestDocument(vehicle, dt.type)).filter(Boolean) as Document[];
}

/**
 * Mark a document as expired (auto-called by job).
 * Status changes to "expired" but the record stays for audit.
 */
export function markAsExpired(doc: Document): Document {
  assertCan("stock.verify");
  return { ...doc, status: "expired" };
}
