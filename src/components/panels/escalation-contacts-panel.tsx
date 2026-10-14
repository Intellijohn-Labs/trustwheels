"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  addEscalationContact,
  deleteEscalationContact,
  escalationContactErrors,
  escalationContacts,
  setEscalationContactActive,
  type EscalationContact,
} from "@/lib/escalation-contacts";
import { Button, Field, Panel, cn, inputClass } from "../ui";
import { useAction } from "../toast";
import { DataTable, type Column } from "../data-table";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const label = (c: EscalationContact) => `${c.name} · +91 ${c.phone}`;

/** +91-prefixed 10-digit mobile input, same visual pattern used for phone fields everywhere else in the app. */
function PhoneInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">+91</span>
      <input
        id="esc-phone"
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="98470 12345"
        className={cn(inputClass(invalid), "pl-12 tabular-nums")}
      />
    </div>
  );
}

function AddContactForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { run, busy } = useAction();
  const errors = escalationContactErrors({ name, phone });
  const show = (k: "name" | "phone") => (submitted ? errors[k] : undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const ok = await run(() => addEscalationContact({ name, phone, designation: designation.trim() || undefined }), `${name.trim()} added`);
    if (ok) {
      setName("");
      setPhone("");
      setDesignation("");
      setSubmitted(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 px-4 py-4 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end sm:px-5">
      <Field label="Name" htmlFor="esc-name" required error={show("name")}>
        <input id="esc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={inputClass(!!show("name"))} />
      </Field>
      <Field label="Phone" htmlFor="esc-phone" required error={show("phone")}>
        <PhoneInput value={phone} onChange={setPhone} invalid={!!show("phone")} />
      </Field>
      <Field label="Designation" htmlFor="esc-designation">
        <input id="esc-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Operations Head" autoComplete="off" className={inputClass()} />
      </Field>
      <Button type="submit" variant="primary" disabled={busy} className="h-10">
        <Plus className="size-4" /> Add contact
      </Button>
    </form>
  );
}

/**
 * Settings-only: who gets notified when a vehicle escalates to Code Red
 * (lib/escalations.ts). Add/toggle-active/delete, Managing Partner only
 * (escalation_contacts.manage - not settings.manage, which HR also holds).
 */
export function EscalationContactsPanel() {
  const { items, ready } = escalationContacts.useItems();
  const { run } = useAction();
  const [confirming, setConfirming] = useState<EscalationContact | null>(null);
  const rows = [...items].sort((a, b) => a.name.localeCompare(b.name));

  const columns: Column<EscalationContact>[] = [
    { header: "Name", cell: (c) => <span className="font-medium whitespace-nowrap">{c.name}</span> },
    {
      header: "Phone",
      cell: (c) => (
        <span className="font-mono whitespace-nowrap tabular-nums">
          +91 {c.phone.slice(0, 5)} {c.phone.slice(5)}
        </span>
      ),
    },
    { header: "Designation", cell: (c) => c.designation || <span className="text-muted">—</span> },
    {
      header: "Active",
      align: "center",
      cell: (c) => (
        <input
          type="checkbox"
          checked={c.isActive}
          onChange={(e) => run(() => setEscalationContactActive(c.id, e.target.checked), e.target.checked ? `${c.name} activated` : `${c.name} deactivated`)}
          aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
          className="size-4 cursor-pointer accent-[var(--brand)]"
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (c) => (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(c)} aria-label={`Delete ${c.name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <Panel flush title="Code Red Alert Contacts" description="Notified when a vehicle escalates to Code Red. Only active contacts are notified.">
      <AddContactForm />
      <div className="border-t border-line">
        <DataTable rows={ready ? rows : []} rowKey={(c) => c.id} empty={ready ? "No alert contacts yet." : "Loading…"} columns={columns} />
      </div>
      {confirming && (
        <ConfirmDeleteDialog count={1} items={[label(confirming)]} noun="contact" onConfirm={() => deleteEscalationContact(confirming.id)} onClose={() => setConfirming(null)} />
      )}
    </Panel>
  );
}
