"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, FileText, Loader2, Package, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button, Pill, cn, inputClass } from "../ui";
import { useAction } from "../toast";
import { useRole } from "@/lib/role-context";
import { DOCUMENT_TYPES, documentLabel } from "@/lib/masters";
import { readDocumentFile } from "@/lib/image";
import { formatDateTime } from "@/lib/format";
import { allRequiredDocsVerified, getLatestDocument, isExpired, missingDocuments } from "@/lib/documents";
import { updateDocuments, verifyDocumentRecord } from "@/lib/stock-store";
import { newId } from "@/lib/collections";
import type { Document, DocumentStatus, DocumentType, Vehicle } from "@/lib/types";

/*
 * Module 3: Document Attachment & Vault. Every mandatory document (RC, insurance, forms,
 * seller KYC, purchase receipt) must be uploaded and verified — not expired — before the
 * vehicle can pass the quality gate onto "On display". That hard lock lives in stock-store's
 * approveGate(); this panel is where the branch team gets the checklist to zero out first.
 */

const STATUS_TONE: Record<DocumentStatus, "neutral" | "warn" | "ok" | "danger"> = {
  pending: "neutral",
  received: "warn",
  verified: "ok",
  expired: "danger",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: "Pending",
  received: "Received · not verified",
  verified: "Verified",
  expired: "Expired",
};

export function DocumentVault({ vehicle: v }: { vehicle: Vehicle }) {
  const { can } = useRole();
  const manage = can("stock.verify");
  const today = new Date().toISOString().slice(0, 10);
  const missing = missingDocuments(v);
  const complete = allRequiredDocsVerified(v);
  const [packOpen, setPackOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Documents & vault</h2>
        {complete ? (
          <Pill tone="ok" icon={<CheckCircle2 className="size-3.5" />}>
            All mandatory documents verified
          </Pill>
        ) : (
          <Pill tone="warn" icon={<AlertTriangle className="size-3.5" />}>
            {missing.length} of {DOCUMENT_TYPES.filter((d) => d.required).length} required outstanding
          </Pill>
        )}
      </div>

      {!complete && (
        <p className="mb-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          Blocked from <strong>On display</strong> until every required document is uploaded, verified and unexpired:{" "}
          {missing.map(documentLabel).join(" · ")}.
        </p>
      )}

      <ul className="divide-y divide-line">
        {DOCUMENT_TYPES.map((dt) => (
          <DocumentRow key={dt.type} vehicle={v} type={dt.type} required={dt.required} hasExpiry={dt.hasExpiry} manage={manage} today={today} />
        ))}
      </ul>

      {v.documents.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <Button size="sm" onClick={() => setPackOpen((o) => !o)}>
            <Package className="size-3.5" /> {packOpen ? "Hide" : "View"} delivery pack ({v.documents.length})
          </Button>
          {packOpen && <DeliveryPack vehicle={v} />}
        </div>
      )}
    </section>
  );
}

function DocumentRow({
  vehicle: v,
  type,
  required,
  hasExpiry,
  manage,
  today,
}: {
  vehicle: Vehicle;
  type: DocumentType;
  required: boolean;
  hasExpiry: boolean;
  manage: boolean;
  today: string;
}) {
  const doc = getLatestDocument(v, type);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { run, busy: acting } = useAction();
  const expired = doc ? isExpired(doc, today) : false;
  const status: DocumentStatus = doc ? (expired ? "expired" : doc.status) : "pending";

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const fileUrl = await readDocumentFile(file);
      const next: Document = {
        id: doc?.id ?? newId("doc"),
        type,
        status: "received",
        fileUrl,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: undefined, // set server-side via getActor()
        expiresAt: doc?.expiresAt,
        notes: doc?.notes,
      };
      const others = v.documents.filter((d) => d.id !== next.id);
      await updateDocuments(v.id, [...others, next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <li className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <FileText className="size-4 shrink-0 text-muted" />
          {documentLabel(type)}
          {required && <span className="text-xs font-normal text-danger">required</span>}
          <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
        </p>
        {doc ? (
          <div className="mt-1 space-y-0.5 pl-6 text-xs text-muted">
            <p>
              {doc.fileName} · uploaded {formatDateTime(doc.uploadedAt!)}
            </p>
            {doc.verifiedAt && doc.verifiedBy && (
              <p className="flex items-center gap-1 text-ok">
                <ShieldCheck className="size-3.5" /> Verified by {doc.verifiedBy} · {formatDateTime(doc.verifiedAt)}
              </p>
            )}
            {hasExpiry && (
              <p className={cn(expired && "font-semibold text-danger")}>
                {expired ? "Expired" : "Expires"} {doc.expiresAt ? doc.expiresAt : "— no expiry date set"}
              </p>
            )}
          </div>
        ) : (
          <p className="pl-6 text-xs text-muted">Not uploaded yet</p>
        )}
        {error && <p className="pl-6 text-xs text-danger">{error}</p>}
      </div>

      {manage && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {hasExpiry && doc && (
            <input
              type="date"
              aria-label={`${documentLabel(type)} expiry date`}
              value={doc.expiresAt ?? ""}
              onChange={(e) => run(() => updateDocuments(v.id, v.documents.map((d) => (d.id === doc.id ? { ...d, expiresAt: e.target.value || undefined } : d))))}
              className={cn(inputClass(), "h-8 w-36 text-xs")}
            />
          )}
          <input ref={input} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {doc ? "Replace" : "Upload"}
          </Button>
          {doc && doc.status !== "verified" && !expired && (
            <Button size="sm" variant="primary" disabled={acting} onClick={() => run(() => verifyDocumentRecord(v.id, doc.id), `${documentLabel(type)} verified`)}>
              <ShieldCheck className="size-3.5" /> Verify
            </Button>
          )}
          {doc && (
            <>
              <a href={doc.fileUrl} target="_blank" rel="noreferrer" aria-label={`View ${documentLabel(type)}`}>
                <Button size="sm" variant="ghost">
                  <Eye className="size-3.5" />
                </Button>
              </a>
              <Button
                size="sm"
                variant="ghost"
                disabled={acting}
                onClick={() => run(() => updateDocuments(v.id, v.documents.filter((d) => d.id !== doc.id)), `${documentLabel(type)} removed`)}
                aria-label={`Remove ${documentLabel(type)}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function DeliveryPack({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {DOCUMENT_TYPES.map((dt) => {
        const doc = getLatestDocument(v, dt.type);
        if (!doc) return null;
        return (
          <li key={dt.type} className="flex items-center gap-2 rounded-xl border border-line bg-sunken/50 px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate">{documentLabel(dt.type)}</span>
            <Pill tone={STATUS_TONE[doc.status]} className="shrink-0">
              {doc.status}
            </Pill>
            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="shrink-0 text-brand hover:underline">
              <Eye className="size-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
