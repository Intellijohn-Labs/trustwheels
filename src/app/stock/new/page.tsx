"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { createVehicle, useVehicles } from "@/lib/stock-store";
import { isSold } from "@/lib/finance";
import { BRANCHES, DOCUMENT_TYPES, MAKES, PHOTO_SLOTS, branchName } from "@/lib/masters";
import { useRole } from "@/lib/role-context";
import { useToast } from "@/components/toast";
import { couldBeReg, displayReg, formatIsoDate, groupIndian, isValidReg, normaliseReg } from "@/lib/format";
import { newId } from "@/lib/collections";
import type { Document, DocumentType, FinanceStatus, Fuel, PhotoSlot } from "@/lib/types";
import { Field, Section, Segmented, inputClass, textareaClass } from "@/components/ui";
import { ColourPicker } from "@/components/colour-picker";
import { MonthPicker } from "@/components/month-picker";
import { PhotoSlotInput } from "@/components/photo-slot";
import { DocumentUploadSlot, type DocumentDraft } from "@/components/document-upload-slot";

// RC book, insurance, and seller KYC can be attached right at intake.
// Forms 28/29/30 come later, during the ownership-transfer step (see the vehicle's Documents & vault panel).
// Finance NOC is rendered separately below, gated on the "under finance" toggle - it doesn't apply
// at all to a vehicle bought free and clear.
const INTAKE_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((d) => d.type !== "forms_2829" && d.type !== "finance_noc");
const FINANCE_NOC = DOCUMENT_TYPES.find((d) => d.type === "finance_noc")!;

interface FormState {
  branchId: string;
  intakeBy: string;
  mfgMonth: string;
  registrationNo: string;
  make: string;
  model: string;
  variant: string;
  engineCc: string;
  odometerKm: string;
  keyCount: string;
  colour: string;
  owners: string;
  fuel?: Fuel;
  chassisNo: string;
  engineNo: string;
  financeStatus?: FinanceStatus;
  financier: string;
  nocSeal?: "yes" | "no";
  nocSign?: "yes" | "no";
  rcKycMismatch: "yes" | "no";
  mismatchRemarks: string;
  rcPhoneWorking: "yes" | "no";
  rcCurrentPhone: string;
  hasChallan?: "yes" | "no";
  challanAmount: string; // whole rupees, digits only
  challanReceived?: "yes" | "no";
  conditionNotes: string;
  frontTyrePercent: string;
  rearTyrePercent: string;
  batteryStatus?: "good" | "not_good";
  knownDefects: string;
  agreedValue: string; // whole rupees, digits only
  sellerName: string;
  sellerPhone: string;
  sellerPhoneAlt: string;
  photos: Partial<Record<PhotoSlot, string>>;
  documents: Partial<Record<DocumentType, DocumentDraft>>;
}

type Errors = Partial<Record<keyof FormState | "photos", string>>;

const EMPTY: FormState = {
  branchId: "",
  intakeBy: "",
  mfgMonth: "",
  registrationNo: "",
  make: "",
  model: "",
  variant: "",
  engineCc: "",
  odometerKm: "",
  keyCount: "2",
  colour: "",
  owners: "",
  chassisNo: "",
  engineNo: "",
  financeStatus: "free",
  financier: "",
  frontTyrePercent: "",
  rearTyrePercent: "",
  rcKycMismatch: "no",
  mismatchRemarks: "",
  rcPhoneWorking: "yes",
  rcCurrentPhone: "",
  challanAmount: "",
  conditionNotes: "",
  knownDefects: "",
  agreedValue: "",
  sellerName: "",
  sellerPhone: "",
  sellerPhoneAlt: "",
  photos: {},
  documents: {},
};

const MAX_OWNERS = 20;
const THIS_YEAR = new Date().getFullYear();
const EARLIEST_YEAR = 1960;
/** "YYYY-MM" for the current month - the latest manufacture month the form accepts. */
const THIS_MONTH = `${THIS_YEAR}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const EARLIEST_MONTH = `${EARLIEST_YEAR}-01`;
const MOBILE_RE = /^[6-9]\d{9}$/;
const digits = (s: string, max = 12) => s.replace(/\D/g, "").slice(0, max);
const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Case-insensitive model lookup so free-text "honda"/"Honda" both surface the same suggestions. */
function modelsFor(make: string): string[] {
  const key = Object.keys(MAKES).find((k) => k.toLowerCase() === make.trim().toLowerCase());
  return key ? MAKES[key] : [];
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  const need = (k: keyof FormState, msg = "Required") => {
    const v = f[k];
    if (v === undefined || v === "") e[k] = msg;
  };
  need("branchId", "Choose a branch");
  if (!f.registrationNo) e.registrationNo = "Required";
  else if (!isValidReg(f.registrationNo)) e.registrationNo = "Not a valid registration number";
  need("make");
  need("model");
  if (!f.mfgMonth) e.mfgMonth = "Required";
  else if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(f.mfgMonth)) e.mfgMonth = "Use the format YYYY-MM";
  else if (f.mfgMonth > THIS_MONTH) e.mfgMonth = "Can't be in the future";
  else if (f.mfgMonth < EARLIEST_MONTH) e.mfgMonth = `Can't be before ${EARLIEST_YEAR}`;
  need("fuel");
  if (!f.colour.trim()) e.colour = "Pick a colour or enter one under Other";
  const owners = Number(f.owners);
  if (f.owners.trim() === "") e.owners = "Required";
  else if (!Number.isInteger(owners) || owners < 1) e.owners = "Enter a whole number, 1 or more";
  else if (owners > MAX_OWNERS) e.owners = `Can't be more than ${MAX_OWNERS}`;
  if (!f.odometerKm) e.odometerKm = "Required";
  if (f.fuel === "petrol" && !f.engineCc) e.engineCc = "Required";
  else if (f.engineCc && !(Number.isFinite(Number(f.engineCc)) && Number(f.engineCc) > 0)) e.engineCc = "Enter a number greater than 0";
  if (f.chassisNo.length < 6) e.chassisNo = f.chassisNo ? "Too short" : "Required";
  if (f.engineNo.length < 5) e.engineNo = f.engineNo ? "Too short" : "Required";
  if (f.financeStatus === "financed") {
    need("financier", "Enter the financier's name");
    need("nocSeal", "Select Yes or No");
    need("nocSign", "Select Yes or No");
  }
  if (f.rcPhoneWorking === "no" && f.rcCurrentPhone && !MOBILE_RE.test(f.rcCurrentPhone)) e.rcCurrentPhone = "Enter a valid 10-digit mobile number";
  need("hasChallan", "Select Yes or No");
  if (f.hasChallan === "yes") {
    if (!f.challanAmount || Number(f.challanAmount) <= 0) e.challanAmount = "Enter the challan amount";
    need("challanReceived", "Select Yes or No");
  }
  for (const k of ["frontTyrePercent", "rearTyrePercent"] as const) {
    const n = Number(f[k]);
    if (f[k] === "") e[k] = "Enter the tyre life, 0 to 100";
    else if (!Number.isFinite(n) || n < 0 || n > 100) e[k] = "Enter a value between 0 and 100";
  }
  need("batteryStatus", "Select the battery condition");
  if (!f.agreedValue || Number(f.agreedValue) <= 0) e.agreedValue = "Enter the purchased value";
  if (!f.sellerName.trim()) e.sellerName = "Enter the seller's name";
  if (!f.sellerPhone) e.sellerPhone = "Enter the seller's mobile number";
  else if (!MOBILE_RE.test(f.sellerPhone)) e.sellerPhone = "Enter a valid 10-digit mobile number";
  if (!f.sellerPhoneAlt) e.sellerPhoneAlt = "Enter an alternate mobile number";
  else if (!MOBILE_RE.test(f.sellerPhoneAlt)) e.sellerPhoneAlt = "Enter a valid 10-digit mobile number";
  else if (f.sellerPhoneAlt === f.sellerPhone) e.sellerPhoneAlt = "Must be different from the seller mobile";
  const missing = PHOTO_SLOTS.filter((p) => !f.photos[p.slot]);
  if (missing.length) e.photos = `Add ${missing.map((m) => m.label.toLowerCase()).join(", ")}`;
  return e;
}

export default function NewVehiclePage() {
  const router = useRouter();
  const { inScope, user } = useRole();
  const toast = useToast();
  const myBranches = BRANCHES.filter((b) => inScope(b.id));
  const [form, setForm] = useState<FormState>(EMPTY);
  // No default branch - the user must pick one explicitly; this only ever falls back to "" if
  // the stored value isn't (or isn't yet) one of the role's in-scope branches.
  const branchId = myBranches.some((b) => b.id === form.branchId) ? form.branchId : "";
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const { vehicles } = useVehicles();

  const errors = useMemo(() => validate(form), [form]);
  const show = (k: keyof Errors) => (submitted || touched[k as keyof FormState] ? errors[k] : undefined);

  // Switching back to "No" drops everything entered for the loan, so none of it is saved by accident.
  const setFinanceStatus = (v: FinanceStatus) =>
    setForm((f) => {
      if (v === "financed") return { ...f, financeStatus: v };
      const documents = { ...f.documents };
      delete documents.finance_noc;
      return { ...f, financeStatus: v, financier: "", nocSeal: undefined, nocSign: undefined, documents };
    });

  // "No" drops the amount and received flag so nothing stale is saved.
  const setHasChallan = (v: "yes" | "no") =>
    setForm((f) => (v === "yes" ? { ...f, hasChallan: v } : { ...f, hasChallan: v, challanAmount: "", challanReceived: undefined }));

  const setMismatch = (v: "yes" | "no") => setForm((f) => ({ ...f, rcKycMismatch: v, mismatchRemarks: v === "yes" ? f.mismatchRemarks : "" }));

  const setRcPhoneWorking = (v: "yes" | "no") => setForm((f) => ({ ...f, rcPhoneWorking: v, rcCurrentPhone: v === "no" ? f.rcCurrentPhone : "" }));

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: keyof FormState) => () => setTouched((t) => ({ ...t, [k]: true }));

  // Live registration check: flag the number the moment a typed character makes it impossible.
  const reg = form.registrationNo;
  const regLive = couldBeReg(reg) ? undefined : "That doesn't match an Indian registration. Example: KL 07 AB 1234";
  const regOk = isValidReg(reg);

  // Duplicate check only looks at vehicles still active in the inventory - a deleted/purged
  // record is already gone from `vehicles` entirely, and a sold vehicle has left the current
  // stock for good, so re-entering that registration later is a genuine repurchase, not a
  // duplicate intake.
  const duplicates = regOk ? vehicles.filter((v) => v.registrationNo === reg && !isSold(v)) : [];

  const photoCount = PHOTO_SLOTS.filter((p) => form.photos[p.slot]).length;
  const errorCount = Object.keys(errors).length;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errorCount) {
      requestAnimationFrame(() =>
        document.querySelector('[role="alert"]')?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      return;
    }
    setSaving(true);
    let vehicle;
    try {
      // Built up front and passed straight into createVehicle, in the same write as everything
      // else - these files are already uploaded to the bucket (DocumentUploadSlot uploads on
      // selection), so there's no reason to save the vehicle first and attach them in a second,
      // separate update() right after. Two writes to a brand-new row can arrive at Supabase out of
      // order; if the plain create (no documents) landed after the one attaching them, it would
      // silently wipe the documents back out - exactly the "documents show as missing on other
      // devices" bug this was causing, since only the uploader's own tab ever saw the correct,
      // merged local state.
      const documents: Document[] = (Object.entries(form.documents) as [DocumentType, DocumentDraft][]).map(([type, d]) => ({
        id: newId("doc"),
        type,
        status: "received",
        fileUrl: d.fileUrl,
        fileName: d.fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
        expiresAt: d.expiresAt,
      }));
      vehicle = await createVehicle({
        // The Source field was removed from this form, but createVehicle's `source` is still
        // required - default every intake through here to "direct" so saving keeps working.
        source: "direct",
        branchId,
        enteredBy: user.name,
        registrationNo: form.registrationNo,
        make: form.make,
        model: form.model,
        variant: form.variant.trim(),
        year: Number(form.mfgMonth.slice(0, 4)),
        month: Number(form.mfgMonth.slice(5, 7)),
        engineCc: Number(form.engineCc) || 0,
        odometerKm: Number(form.odometerKm),
        colour: form.colour.trim(),
        owners: Number(form.owners),
        fuel: form.fuel!,
        chassisNo: form.chassisNo,
        engineNo: form.engineNo,
        financeStatus: form.financeStatus ?? "free",
        financier: form.financeStatus === "financed" ? form.financier.trim() : undefined,
        // The separate NOC status field is gone: a NOC file uploaded here counts as received.
        nocStatus: form.financeStatus === "financed" ? (form.documents.finance_noc ? "received" : "pending") : undefined,
        nocSeal: form.financeStatus === "financed" ? form.nocSeal : undefined,
        nocSign: form.financeStatus === "financed" ? form.nocSign : undefined,
        conditionNotes: form.conditionNotes.trim(),
        rcKycMismatch: form.rcKycMismatch,
        mismatchRemarks: form.rcKycMismatch === "yes" && form.mismatchRemarks.trim() ? form.mismatchRemarks.trim() : undefined,
        rcPhoneWorking: form.rcPhoneWorking,
        rcCurrentPhone: form.rcPhoneWorking === "no" && form.rcCurrentPhone ? form.rcCurrentPhone : undefined,
        hasChallan: form.hasChallan!,
        challanAmountPaise: form.hasChallan === "yes" ? Number(form.challanAmount) * 100 : undefined,
        challanReceived: form.hasChallan === "yes" ? form.challanReceived : undefined,
        frontTyrePercent: Number(form.frontTyrePercent),
        rearTyrePercent: Number(form.rearTyrePercent),
        batteryStatus: form.batteryStatus!,
        knownDefects: form.knownDefects.trim(),
        agreedValuePaise: Number(form.agreedValue) * 100,
        seller: { name: form.sellerName.trim(), phone: form.sellerPhone, phoneAlt: form.sellerPhoneAlt },
        photos: form.photos,
        documents,
      });
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not save");
      setSaving(false);
      return;
    }
    router.push(`/stock/${vehicle.id}?created=1`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Stock
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add stock</h1>
        <p className="text-sm text-muted">A provisional ID is issued on save. The permanent Stock ID is issued when Angamaly receives the vehicle.</p>
      </div>

      <Section title="Intake">
        <Field label="Branch" htmlFor="branch" required error={show("branchId")} wide>
          <select id="branch" value={branchId} onChange={(e) => set("branchId", e.target.value)} onBlur={touch("branchId")} className={inputClass(!!show("branchId"))}>
            <option value="">Select branch</option>
            {myBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Intake employee / Added by" htmlFor="intakeBy">
          <input
            id="intakeBy"
            placeholder="e.g. Employee name or Staff ID"
            value={form.intakeBy}
            onChange={(e) => set("intakeBy", e.target.value)}
            className={inputClass()}
          />
        </Field>
      </Section>

      <Section title="Vehicle">
        <Field
          label="Registration no."
          htmlFor="reg"
          required
          wide
          error={regLive ?? show("registrationNo")}
          hint={regOk ? <span className="inline-flex items-center gap-1 text-ok"><CheckCircle2 className="size-3.5" /> {displayReg(reg)}</span> : "Example: KL 07 AB 1234"}
        >
          <input
            id="reg"
            value={displayReg(reg)}
            onChange={(e) => set("registrationNo", normaliseReg(e.target.value).replace(/[^A-Z0-9]/g, "").slice(0, 11))}
            onBlur={touch("registrationNo")}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="KL 07 AB 1234"
            className={`${inputClass(!!(regLive ?? show("registrationNo")))} font-mono tracking-wider uppercase`}
          />
        </Field>
        {duplicates.length > 0 && (
          <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn sm:col-span-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">This registration is already in the system</p>
              {duplicates.map((d) => (
                <p key={d.id}>
                  <Link href={`/stock/${d.id}`} className="underline" target="_blank">
                    {d.stockId ?? d.provisionalId}
                  </Link>{" "}
                  · {d.make} {d.model} · {branchName(d.branchId)} · entered {formatIsoDate(d.createdAt.slice(0, 10))}
                </p>
              ))}
              <p className="mt-1 text-xs opacity-80">You can still save if this is a genuine re-purchase.</p>
            </div>
          </div>
        )}

        <Field label="Make" htmlFor="make" required error={show("make")}>
          <input
            id="make"
            list="make-options"
            value={form.make}
            onChange={(e) => set("make", e.target.value)}
            onBlur={touch("make")}
            placeholder="e.g. Honda, Hero, TVS"
            autoComplete="off"
            className={inputClass(!!show("make"))}
          />
          <datalist id="make-options">
            {Object.keys(MAKES).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Model" htmlFor="model" required error={show("model")}>
          <input
            id="model"
            list="model-options"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            onBlur={touch("model")}
            placeholder="e.g. Activa 6G, Splendor Plus"
            autoComplete="off"
            className={inputClass(!!show("model"))}
          />
          <datalist id="model-options">
            {modelsFor(form.make).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Variant" htmlFor="variant">
          <input id="variant" value={form.variant} onChange={(e) => set("variant", e.target.value)} placeholder="e.g. DLX, Disc" className={inputClass()} />
        </Field>
        <Field label="Mfg month & year" htmlFor="mfgMonth" required error={show("mfgMonth")}>
          <MonthPicker
            id="mfgMonth"
            value={form.mfgMonth}
            min={EARLIEST_MONTH}
            max={THIS_MONTH}
            onChange={(v) => set("mfgMonth", v)}
            onBlur={touch("mfgMonth")}
            invalid={!!show("mfgMonth")}
          />
        </Field>
        <Field label="Fuel" required error={show("fuel")}>
          <Segmented
            name="Fuel"
            value={form.fuel}
            onChange={(v) => set("fuel", v)}
            options={[
              { value: "petrol", label: "Petrol" },
              { value: "electric", label: "Electric" },
            ]}
          />
        </Field>
        <Field label={form.fuel === "electric" ? "Motor (W)" : "Engine CC"} htmlFor="cc" required={form.fuel !== "electric"} error={show("engineCc")}>
          <input
            id="cc"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={form.engineCc}
            onChange={(e) => set("engineCc", e.target.value)}
            onBlur={touch("engineCc")}
            placeholder={form.fuel === "electric" ? "e.g. 3300" : "e.g. 125"}
            className={inputClass(!!show("engineCc"))}
          />
        </Field>
        <Field label="Odometer (km)" htmlFor="odo" required error={show("odometerKm")}>
          <input
            id="odo"
            inputMode="numeric"
            value={groupIndian(form.odometerKm)}
            onChange={(e) => set("odometerKm", digits(e.target.value, 7))}
            onBlur={touch("odometerKm")}
            placeholder="e.g. 18,400"
            className={inputClass(!!show("odometerKm"))}
          />
        </Field>
        <Field label="Keys" htmlFor="keys">
          <div className="grid grid-cols-4 gap-2 pt-0.5">
            {[
              { val: "0", display: "0" },
              { val: "1", display: "1" },
              { val: "2", display: "2" },
              { val: "3", display: "3" },
            ].map((k) => {
              const active = form.keyCount === k.val;
              return (
                <button
                  key={k.val}
                  type="button"
                  onClick={() => set("keyCount", k.val)}
                  className={`flex h-10 items-center justify-center rounded-xl border font-mono text-sm font-bold transition-all select-none active:scale-95 ${active ? "border-brand bg-brand/10 text-brand shadow-sm shadow-brand/20 ring-1 ring-brand" : "border-line bg-surface hover:bg-sunken text-muted hover:text-foreground"}`}
                >
                  {k.display}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Colour" htmlFor="colour" required error={show("colour")}>
          <ColourPicker id="colour" value={form.colour} onChange={(v) => set("colour", v)} onBlur={touch("colour")} invalid={!!show("colour")} />
        </Field>
        <Field label="No. of owners" htmlFor="owners" required error={show("owners")}>
          <input
            id="owners"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_OWNERS}
            step={1}
            value={form.owners}
            onChange={(e) => set("owners", e.target.value)}
            onBlur={touch("owners")}
            placeholder="Enter number of owners"
            className={inputClass(!!show("owners"))}
          />
        </Field>
        
        
      </Section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              Photos <span className="text-danger">*</span>
            </h2>
            <p className="mt-0.5 text-sm text-muted">Four sides, the odometer, and the chassis no. photographed next to the RC.</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${photoCount === 6 ? "bg-ok-soft text-ok" : "bg-sunken text-muted"}`}>
            {photoCount}/6
          </span>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PHOTO_SLOTS.map((p) => (
            <PhotoSlotInput
              key={p.slot}
              label={p.label}
              hint={p.hint}
              value={form.photos[p.slot]}
              invalid={submitted && !form.photos[p.slot]}
              onChange={(url) => setForm((f) => ({ ...f, photos: { ...f.photos, [p.slot]: url } }))}
            />
          ))}
        </div>
        {submitted && errors.photos && (
          <p className="mt-3 text-xs font-medium text-danger" role="alert">
            {errors.photos}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <header className="mb-4">
          <h2 className="text-base font-semibold">Documents</h2>
          <p className="mt-0.5 text-sm text-muted">
            Attach whatever the seller has on hand now. Anything missing can be added later from the vehicle page, but it must be verified before the
            vehicle can go on display.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {INTAKE_DOCUMENT_TYPES.map((d) => (
            <DocumentUploadSlot
              key={d.type}
              label={d.label}
              required={d.required}
              hasExpiry={d.hasExpiry}
              value={form.documents[d.type]}
              onChange={(value) => setForm((f) => ({ ...f, documents: { ...f.documents, [d.type]: value } }))}
            />
          ))}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <Field label="Mismatch between RC Book & Seller KYC details?" wide>
            <Segmented
              name="RC and KYC mismatch"
              value={form.rcKycMismatch}
              onChange={setMismatch}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
            />
          </Field>
          {form.rcKycMismatch === "yes" && (
            <div className="mt-3">
              <Field label="Mismatch reason / remarks" htmlFor="mismatchRemarks" hint="Optional - briefly say what differs, e.g. name spelling or address.">
                <textarea
                  id="mismatchRemarks"
                  value={form.mismatchRemarks}
                  onChange={(e) => set("mismatchRemarks", e.target.value.slice(0, 300))}
                  maxLength={300}
                  placeholder="e.g. RC shows the previous owner's name"
                  className={textareaClass()}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <Field label="Is RC registered phone number active / working?" wide>
            <Segmented
              name="RC phone working"
              value={form.rcPhoneWorking}
              onChange={setRcPhoneWorking}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
            />
          </Field>
          {form.rcPhoneWorking === "no" && (
            <div className="mt-3">
              <Field label="Current working mobile number" htmlFor="rcCurrentPhone" error={show("rcCurrentPhone")} hint="Optional - if different from the seller mobile.">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-muted">+91</span>
                  <input
                    id="rcCurrentPhone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.rcCurrentPhone}
                    onChange={(e) => set("rcCurrentPhone", digits(e.target.value, 10))}
                    onBlur={touch("rcCurrentPhone")}
                    placeholder="98470 12345"
                    className={`${inputClass(!!show("rcCurrentPhone"))} pl-12 tabular-nums`}
                  />
                </div>
              </Field>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <Field label="Vehicle under finance / hypothecation?" wide>
            <Segmented
              name="Under finance"
              value={form.financeStatus}
              onChange={setFinanceStatus}
              options={[
                { value: "free", label: "No" },
                { value: "financed", label: "Yes" },
              ]}
            />
          </Field>
          {form.financeStatus === "financed" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Financier name" htmlFor="financier" required error={show("financier")} wide>
                <input
                  id="financier"
                  value={form.financier}
                  onChange={(e) => set("financier", e.target.value)}
                  onBlur={touch("financier")}
                  autoComplete="off"
                  placeholder="Bank or financier, e.g. Muthoot Capital"
                  className={inputClass(!!show("financier"))}
                />
              </Field>
              <Field label="NOC seal" required error={show("nocSeal")}>
                <Segmented
                  name="NOC seal"
                  value={form.nocSeal}
                  onChange={(v) => set("nocSeal", v)}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </Field>
              <Field label="NOC sign" required error={show("nocSign")}>
                <Segmented
                  name="NOC sign"
                  value={form.nocSign}
                  onChange={(v) => set("nocSign", v)}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                />
              </Field>
              <DocumentUploadSlot
                label={FINANCE_NOC.label}
                required
                hasExpiry={FINANCE_NOC.hasExpiry}
                value={form.documents.finance_noc}
                onChange={(value) => setForm((f) => ({ ...f, documents: { ...f.documents, finance_noc: value } }))}
              />
            </div>
          )}
        </div>
      </section>

      <Section title="Challan">
        <Field label="Challan pending / amount pending?" required error={show("hasChallan")} wide>
          <Segmented
            name="Challan pending"
            value={form.hasChallan}
            onChange={setHasChallan}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
          />
        </Field>
        {form.hasChallan === "yes" && (
          <>
            <Field label="Challan amount" htmlFor="challanAmount" required error={show("challanAmount")}>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-muted">₹</span>
                <input
                  id="challanAmount"
                  inputMode="numeric"
                  value={groupIndian(form.challanAmount)}
                  onChange={(e) => set("challanAmount", digits(e.target.value, 7))}
                  onBlur={touch("challanAmount")}
                  placeholder="e.g. 1,500"
                  className={`${inputClass(!!show("challanAmount"))} pl-8 tabular-nums`}
                />
              </div>
            </Field>
            <Field label="Challan amount received?" required error={show("challanReceived")}>
              <Segmented
                name="Challan amount received"
                value={form.challanReceived}
                onChange={(v) => set("challanReceived", v)}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title="Condition">
        <Field label="Front tyre" htmlFor="frontTyre" required error={show("frontTyrePercent")}>
          <div className="relative">
            <input
              id="frontTyre"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={form.frontTyrePercent}
              onChange={(e) => set("frontTyrePercent", e.target.value)}
              onBlur={touch("frontTyrePercent")}
              placeholder="e.g. 70"
              className={`${inputClass(!!show("frontTyrePercent"))} pr-10 tabular-nums`}
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-base text-muted">%</span>
          </div>
        </Field>
        <Field label="Rear tyre" htmlFor="rearTyre" required error={show("rearTyrePercent")}>
          <div className="relative">
            <input
              id="rearTyre"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={form.rearTyrePercent}
              onChange={(e) => set("rearTyrePercent", e.target.value)}
              onBlur={touch("rearTyrePercent")}
              placeholder="e.g. 70"
              className={`${inputClass(!!show("rearTyrePercent"))} pr-10 tabular-nums`}
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-base text-muted">%</span>
          </div>
        </Field>
        <Field label="Battery condition" required error={show("batteryStatus")} wide>
          <Segmented
            name="Battery condition"
            value={form.batteryStatus}
            onChange={(v) => set("batteryStatus", v)}
            options={[
              { value: "good", label: "Good" },
              { value: "not_good", label: "Bad" },
            ]}
          />
        </Field>
        <Field label="Condition notes" htmlFor="notes">
          <textarea id="notes" value={form.conditionNotes} onChange={(e) => set("conditionNotes", e.target.value)} placeholder="Paint, body, anything else worth noting…" className={textareaClass()} />
        </Field>
        <Field label="Known defects" htmlFor="defects">
          <textarea id="defects" value={form.knownDefects} onChange={(e) => set("knownDefects", e.target.value)} placeholder="Anything the workshop should fix" className={textareaClass()} />
        </Field>
      </Section>

      <Section title="Seller & value">
        <Field label="Seller name" htmlFor="seller" required error={show("sellerName")}>
          <input id="seller" value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} onBlur={touch("sellerName")} autoComplete="off" className={inputClass(!!show("sellerName"))} />
        </Field>
        <Field label="Seller mobile" htmlFor="phone" required error={show("sellerPhone")}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-muted">+91</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={form.sellerPhone}
              onChange={(e) => set("sellerPhone", digits(e.target.value, 10))}
              onBlur={touch("sellerPhone")}
              placeholder="98470 12345"
              className={`${inputClass(!!show("sellerPhone"))} pl-12 tabular-nums`}
            />
          </div>
        </Field>
        <Field label="Seller alternate mobile number" htmlFor="phoneAlt" required error={show("sellerPhoneAlt")}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-muted">+91</span>
            <input
              id="phoneAlt"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={form.sellerPhoneAlt}
              onChange={(e) => set("sellerPhoneAlt", digits(e.target.value, 10))}
              onBlur={touch("sellerPhoneAlt")}
              placeholder="98470 12345"
              className={`${inputClass(!!show("sellerPhoneAlt"))} pl-12 tabular-nums`}
            />
          </div>
        </Field>
        <Field label="Purchased value" htmlFor="value" required error={show("agreedValue")} hint="Seller KYC, bank details and deductions are captured in the acquisition step." wide>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-muted">₹</span>
            <input
              id="value"
              inputMode="numeric"
              value={groupIndian(form.agreedValue)}
              onChange={(e) => set("agreedValue", digits(e.target.value, 8))}
              onBlur={touch("agreedValue")}
              placeholder="1,25,000"
              className={`${inputClass(!!show("agreedValue"))} pl-8 text-lg font-semibold tabular-nums`}
            />
          </div>
        </Field>
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-muted">
            {submitted && errorCount > 0 ? (
              <span className="font-medium text-danger">
                {errorCount} {errorCount === 1 ? "field needs" : "fields need"} attention
              </span>
            ) : (
              <>
                {photoCount}/6 photos
              </>
            )}
          </p>
          <Link href="/stock" className="h-12 rounded-xl px-4 text-sm leading-[3rem] font-medium text-muted hover:text-ink">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save vehicle
          </button>
        </div>
      </div>
    </form>
  );
}
