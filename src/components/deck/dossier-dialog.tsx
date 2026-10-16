"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileArchive, FileText, Loader2 } from "lucide-react";
import { Dialog } from "../panels/dialog";
import { Button, Pill } from "../ui";
import { DECK_THEMES, deckStatus, deckStatusLabel, dossierFiles, dossierSections, type DossierFile } from "@/lib/deck";
import { displayReg, formatIsoDate } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { buildZip, downloadUrl, fetchBlob, safeName, saveBlob, withExtension, type ZipEntry } from "@/lib/zip";
import type { DocumentStatus, Vehicle } from "@/lib/types";

const STATUS_TONE: Record<DocumentStatus, "neutral" | "warn" | "ok" | "danger"> = { pending: "neutral", received: "warn", verified: "ok", expired: "danger" };

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {title}
        {count != null && <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-muted tabular-nums">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

function DownloadButton({ file, label }: { file: DossierFile; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title="Download"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await downloadUrl(file.url!, file.base);
        setBusy(false);
      }}
      className="btn-tap grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface text-ink hover:bg-sunken disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </button>
  );
}

/** Plain-text copy of the details, saved inside the ZIP next to the files. */
function dossierText(v: Vehicle, missing: string[]) {
  const lines = [`VEHICLE DOSSIER - ${displayReg(v.registrationNo) || v.id}`, `Prepared ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}`, ""];
  for (const s of dossierSections(v)) {
    lines.push(s.title.toUpperCase());
    for (const [k, val] of s.rows) lines.push(`  ${k}: ${val}`);
    lines.push("");
  }
  if (missing.length) lines.push("NOT INCLUDED (could not be read)", ...missing.map((m) => `  ${m}`), "");
  return lines.join("\n");
}

/**
 * The full dossier for one vehicle: every detail, every photo, every document, each downloadable
 * on its own, plus one button that bundles the lot (and a text copy of the details) into a ZIP.
 */
export function DossierDialog({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { can } = useRole();
  const status = deckStatus(v);
  const theme = DECK_THEMES[status];
  const files = dossierFiles(v);
  const photoGroups = ["Intake photos", "Reconditioning photos"].map((g) => ({ g, items: files.filter((f) => f.group === g) })).filter((x) => x.items.length);
  const documents = files.filter((f) => f.kind === "document");
  const downloadable = files.filter((f) => f.url);
  const [pack, setPack] = useState<{ done: number; total: number } | null>(null);
  const [packError, setPackError] = useState<string>();

  async function downloadPack() {
    setPackError(undefined);
    setPack({ done: 0, total: downloadable.length });
    const entries: ZipEntry[] = [];
    const missing: string[] = [];
    const used = new Set<string>();
    try {
      for (const [i, f] of downloadable.entries()) {
        const blob = await fetchBlob(f.url!);
        if (blob) {
          const folder = f.kind === "photo" ? "photos" : "documents";
          let name = `${folder}/${safeName(withExtension(f.base, blob, f.url!))}`;
          for (let n = 2; used.has(name); n++) name = `${folder}/${safeName(withExtension(`${f.base} (${n})`, blob, f.url!))}`;
          used.add(name);
          entries.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        } else {
          missing.push(`${f.group}: ${f.label}`);
        }
        setPack({ done: i + 1, total: downloadable.length });
      }
      entries.unshift({ name: "dossier.txt", data: new TextEncoder().encode(dossierText(v, missing)) });
      saveBlob(buildZip(entries), `${safeName(displayReg(v.registrationNo) || v.id)} - vehicle pack.zip`);
      if (missing.length) setPackError(`${missing.length} file${missing.length === 1 ? "" : "s"} couldn't be read and ${missing.length === 1 ? "was" : "were"} left out (listed in dossier.txt).`);
    } finally {
      setPack(null);
    }
  }

  return (
    <Dialog
      wide
      title={`${v.make} ${v.model}`}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono">{displayReg(v.registrationNo)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: `linear-gradient(135deg, ${theme.bg1}, ${theme.bg2})` }}>
            <span className="size-1.5 rounded-full bg-white" />
            {deckStatusLabel(v, status)}
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-2">
          {packError && (
            <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2 text-xs font-medium text-warn">
              {packError}
            </p>
          )}
          <div className="flex gap-3">
            <Button size="lg" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button size="lg" variant="primary" className="flex-[2]" disabled={!!pack} onClick={downloadPack}>
              {pack ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
              {pack ? `Preparing ${pack.done}/${pack.total}…` : `Download vehicle pack (ZIP) · ${downloadable.length} file${downloadable.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {can("stock.view") && (
          <Link href={`/stock/${v.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <ExternalLink className="size-3.5" /> Open the vehicle page
          </Link>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {dossierSections(v).map((s) => (
            <Section key={s.title} title={s.title}>
              <dl className="space-y-2 text-sm">
                {s.rows.map(([k, val]) => (
                  <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 font-medium break-words">{val}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ))}
        </div>

        <Section title="Photos" count={photoGroups.reduce((n, x) => n + x.items.length, 0)}>
          {photoGroups.length === 0 ? (
            <p className="text-sm text-muted">No photos on record.</p>
          ) : (
            <div className="space-y-4">
              {photoGroups.map(({ g, items }) => (
                <div key={g}>
                  <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">{g}</p>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((f) => (
                      <li key={f.base} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sunken">
                        <a href={f.url} target="_blank" rel="noreferrer" aria-label={`Open ${f.label}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- hosted or data-URL photo */}
                          <img src={f.url} alt={f.label} className="size-full object-cover" />
                        </a>
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-xs font-medium text-white">{f.label}</span>
                        <span className="absolute top-2 right-2">
                          <DownloadButton file={f} label={`Download ${f.label}`} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Documents" count={documents.length}>
          {documents.length === 0 ? (
            <p className="text-sm text-muted">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {documents.map((f) => (
                <li key={f.label} className="flex items-center gap-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted">{f.url ? (f.expiresAt ? `Valid till ${formatIsoDate(f.expiresAt)}` : "File attached") : "No file attached"}</p>
                  </div>
                  {f.status && <Pill tone={STATUS_TONE[f.status]}>{f.status}</Pill>}
                  {f.url && (
                    <>
                      <a href={f.url} target="_blank" rel="noreferrer" aria-label={`Open ${f.label}`} title="Open" className="btn-tap grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface text-ink hover:bg-sunken">
                        <ExternalLink className="size-4" />
                      </a>
                      <DownloadButton file={f} label={`Download ${f.label}`} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Dialog>
  );
}
