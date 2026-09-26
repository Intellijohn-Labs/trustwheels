"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { createVehicle, updateDocuments, useVehicles } from "@/lib/stock-store";
import { BRANCHES, COLOURS, DOCUMENT_TYPES, MAKES, PHOTO_SLOTS, branchName } from "@/lib/masters";
import { useRole } from "@/lib/role-context";
import { useToast } from "@/components/toast";
import { couldBeReg, displayReg, formatIsoDate, groupIndian, isValidReg, normaliseReg } from "@/lib/format";
import { newId } from "@/lib/collections";
import type { AccidentHistory, Document, DocumentType, FinanceStatus, Fuel, NocStatus, PhotoSlot, Source } from "@/lib/types";
import { Field, Section, Segmented, inputClass, textareaClass } from "@/components/ui";
import { PhotoSlotInput } from "@/components/photo-slot";
import { DocumentUploadSlot, type DocumentDraft } from "@/components/document-upload-slot";

// RC book, insurance, finance NOC, seller KYC and purchase receipt can be attached right at intake.
// Forms 28/29/30 come later, during the ownership-transfer step (see the vehicle's Documents & vault panel).
const INTAKE_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((d) => d.type !== "forms_2829");

interface FormState {
  source?: Source;
  branchId: string;
  registrationNo: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  engineCc: string;
  odometerKm: string;
  colour: string;
  owners: string;
  fuel?: Fuel;
  chassisNo: string;
  engineNo: string;
  insuranceValidTill: string;
  insurancePolicyNo: string;
  financeStatus?: FinanceStatus;
  financier: string;
  nocStatus?: NocStatus;
  conditionNotes: string;
  accidentHistory?: AccidentHistory;
  knownDefects: string;
  agreedValue: string; // whole rupees, digits only
  sellerName: string;
  sellerPhone: string;
  photos: Partial<Record<PhotoSlot, string>>;
  documents: Partial<Record<DocumentType, DocumentDraft>>;
}

type Errors = Partial<Record<keyof FormState | "photos", string>>;

const EMPTY: FormState = {
  branchId: "",
  registrationNo: "",
  make: "",
  model: "",
  variant: "",
  year: "",
  engineCc: "",
  odometerKm: "",
  colour: "",
  owners: "1",
  chassisNo: "",
  engineNo: "",
  insuranceValidTill: "",
  insurancePolicyNo: "",
  financier: "",
  conditionNotes: "",
  knownDefects: "",
  agreedValue: "",
  sellerName: "",
  sellerPhone: "",
  photos: {},
  documents: {},
};

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 26 }, (_, i) => String(THIS_YEAR - i));
const digits = (s: string, max = 12) => s.replace(/\D/g, "").slice(0, max);
const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function validate(f: FormState): Errors {
  const e: Errors = {};
  const need = (k: keyof FormState, msg = "Required") => {
    const v = f[k];
    if (v === undefined || v === "") e[k] = msg;
  };
  need("source", "Choose how this vehicle came in");
  if (!f.registrationNo) e.registrationNo = "Required";
  else if (!isValidReg(f.registrationNo)) e.registrationNo = "Not a valid registration number";
  need("make");
  need("model");
  need("year");
  need("fuel");
  need("colour");
  if (!f.odometerKm) e.odometerKm = "Required";
  if (f.fuel === "petrol" && !f.engineCc) e.engineCc = "Required";
  if (f.chassisNo.length < 6) e.chassisNo = f.chassisNo ? "Too short" : "Required";
  if (f.engineNo.length < 5) e.engineNo = f.engineNo ? "Too short" : "Required";
  need("financeStatus");
  if (f.financeStatus === "financed") {
    need("financier");
    need("nocStatus");
  }
  need("accidentHistory");
  if (!f.agreedValue || Number(f.agreedValue) <= 0) e.agreedValue = "Enter the agreed value";
  need("sellerName");
  if (!/^[6-9]\d{9}$/.test(f.sellerPhone)) e.sellerPhone = f.sellerPhone ? "Enter a 10-digit mobile number" : "Required";
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
  // Default to the user's own branch; never a branch outside the role's scope.
  const branchId = myBranches.some((b) => b.id === form.branchId) ? form.branchId : inScope(user.base) ? user.base : (myBranches[0]?.id ?? "");
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const { vehicles } = useVehicles();

  const errors = useMemo(() => validate(form), [form]);
  const show = (k: keyof Errors) => (submitted || touched[k as keyof FormState] ? errors[k] : undefined);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: keyof FormState) => () => setTouched((t) => ({ ...t, [k]: true }));

  // Live registration check: flag the number the moment a typed character makes it impossible.
  const reg = form.registrationNo;
  const regLive = couldBeReg(reg) ? undefined : "That doesn't match an Indian registration. Example: KL 07 AB 1234";
  const regOk = isValidReg(reg);

  // Duplicate check runs across all history, including sold and delivered vehicles.
  const duplicates = regOk ? vehicles.filter((v) => v.registrationNo === reg) : [];

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
      vehicle = await createVehicle({
        source: form.source!,
        branchId,
        enteredBy: user.name,
        registrationNo: form.registrationNo,
        make: form.make,
        model: form.model,
        variant: form.variant.trim(),
        year: Number(form.year),
        engineCc: Number(form.engineCc) || 0,
        odometerKm: Number(form.odometerKm),
        colour: form.colour,
        owners: Number(form.owners),
        fuel: form.fuel!,
        chassisNo: form.chassisNo,
        engineNo: form.engineNo,
        insuranceValidTill: form.insuranceValidTill || undefined,
        insurancePolicyNo: form.insurancePolicyNo.trim(),
        financeStatus: form.financeStatus!,
        financier: form.financeStatus === "financed" ? form.financier.trim() : undefined,
        nocStatus: form.financeStatus === "financed" ? form.nocStatus : undefined,
        conditionNotes: form.conditionNotes.trim(),
        accidentHistory: form.accidentHistory!,
        knownDefects: form.knownDefects.trim(),
        agreedValuePaise: Number(form.agreedValue) * 100,
        seller: { name: form.sellerName.trim(), phone: form.sellerPhone },
        photos: form.photos,
      });
      const attached = Object.entries(form.documents) as [DocumentType, DocumentDraft][];
      if (attached.length) {
        const documents: Document[] = attached.map(([type, d]) => ({
          id: newId("doc"),
          type,
          status: "received",
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          uploadedAt: new Date().toISOString(),
          expiresAt: d.expiresAt,
        }));
        await updateDocuments(vehicle.id, documents);
      }
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
        <Field label="Source" required error={show("source")} wide>
          <Segmented
            name="Source"
            value={form.source}
            onChange={(v) => set("source", v)}
            options={[
              { value: "exchange", label: "Branch exchange" },
              { value: "direct", label: "Direct purchase" },
            ]}
          />
        </Field>
        <Field label="Branch" htmlFor="branch" required error={show("branchId")} wide>
          <select id="branch" value={branchId} onChange={(e) => set("branchId", e.target.value)} className={inputClass(!!show("branchId"))}>
            {myBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
          <select
            id="make"
            value={form.make}
            onChange={(e) => setForm((f) => ({ ...f, make: e.target.value, model: "" }))}
            onBlur={touch("make")}
            className={inputClass(!!show("make"))}
          >
            <option value="">Select make</option>
            {Object.keys(MAKES).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Model" htmlFor="model" required error={show("model")}>
          <select
            id="model"
            value={form.model}
            disabled={!form.make}
            onChange={(e) => set("model", e.target.value)}
            onBlur={touch("model")}
            className={inputClass(!!show("model"))}
          >
            <option value="">{form.make ? "Select model" : "Choose make first"}</option>
            {(MAKES[form.make] ?? []).map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Variant" htmlFor="variant">
          <input id="variant" value={form.variant} onChange={(e) => set("variant", e.target.value)} placeholder="e.g. DLX, Disc" className={inputClass()} />
        </Field>
        <Field label="Year" htmlFor="year" required error={show("year")}>
          <select id="year" value={form.year} onChange={(e) => set("year", e.target.value)} onBlur={touch("year")} className={inputClass(!!show("year"))}>
            <option value="">Select year</option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
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
            inputMode="numeric"
            value={form.engineCc}
            onChange={(e) => set("engineCc", digits(e.target.value, 5))}
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
        <Field label="Colour" htmlFor="colour" required error={show("colour")}>
          <select id="colour" value={form.colour} onChange={(e) => set("colour", e.target.value)} onBlur={touch("colour")} className={inputClass(!!show("colour"))}>
            <option value="">Select colour</option>
            {COLOURS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="No. of owners" required>
          <Segmented
            name="Owners"
            value={form.owners}
            onChange={(v) => set("owners", v)}
            options={["1", "2", "3", "4"].map((n) => ({ value: n, label: n === "4" ? "4+" : n }))}
          />
        </Field>
        <Field label="Chassis no." htmlFor="chassis" required error={show("chassisNo")}>
          <input
            id="chassis"
            value={form.chassisNo}
            onChange={(e) => set("chassisNo", alnum(e.target.value).slice(0, 17))}
            onBlur={touch("chassisNo")}
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass(!!show("chassisNo"))} font-mono uppercase`}
          />
        </Field>
        <Field label="Engine no." htmlFor="engine" required error={show("engineNo")}>
          <input
            id="engine"
            value={form.engineNo}
            onChange={(e) => set("engineNo", alnum(e.target.value).slice(0, 17))}
            onBlur={touch("engineNo")}
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass(!!show("engineNo"))} font-mono uppercase`}
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
      </section>

      <Section title="Insurance & finance">
        <Field label="Insurance valid till" htmlFor="ins-date">
          <input id="ins-date" type="date" value={form.insuranceValidTill} onChange={(e) => set("insuranceValidTill", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Policy no." htmlFor="policy">
          <input id="policy" value={form.insurancePolicyNo} onChange={(e) => set("insurancePolicyNo", e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Finance status" required error={show("financeStatus")} wide>
          <Segmented
            name="Finance status"
            value={form.financeStatus}
            onChange={(v) => set("financeStatus", v)}
            options={[
              { value: "free", label: "Free (no loan)" },
              { value: "financed", label: "Under finance" },
            ]}
          />
        </Field>
        {form.financeStatus === "financed" && (
          <>
            <Field label="Financier" htmlFor="financier" required error={show("financier")}>
              <input
                id="financier"
                value={form.financier}
                onChange={(e) => set("financier", e.target.value)}
                onBlur={touch("financier")}
                placeholder="e.g. Muthoot Capital"
                className={inputClass(!!show("financier"))}
              />
            </Field>
            <Field label="NOC status" required error={show("nocStatus")}>
              <Segmented
                name="NOC status"
                value={form.nocStatus}
                onChange={(v) => set("nocStatus", v)}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "received", label: "Received" },
                ]}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title="Condition">
        <Field label="Accident history" required error={show("accidentHistory")} wide>
          <Segmented
            name="Accident history"
            value={form.accidentHistory}
            onChange={(v) => set("accidentHistory", v)}
            options={[
              { value: "none", label: "None" },
              { value: "minor", label: "Minor" },
              { value: "major", label: "Major" },
            ]}
          />
        </Field>
        <Field label="Condition notes" htmlFor="notes">
          <textarea id="notes" value={form.conditionNotes} onChange={(e) => set("conditionNotes", e.target.value)} placeholder="Tyres, paint, battery…" className={textareaClass()} />
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
              value={form.sellerPhone}
              onChange={(e) => set("sellerPhone", digits(e.target.value, 10))}
              onBlur={touch("sellerPhone")}
              placeholder="98470 12345"
              className={`${inputClass(!!show("sellerPhone"))} pl-12 tabular-nums`}
            />
          </div>
        </Field>
        <Field label="Agreed value" htmlFor="value" required error={show("agreedValue")} hint="Seller KYC, bank details and deductions are captured in the acquisition step." wide>
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
