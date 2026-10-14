"use client";

import { defineCollection, newId } from "./collections";
import { assertCan } from "./session";

/*
 * Who gets notified when a vehicle escalates to Code Red (see lib/escalations.ts). A plain
 * collection, same { id, data, created_at } shape as every other table in this app - managed
 * entirely from the Settings page's "Code Red Alert Contacts" panel, Managing Partner only.
 */

export interface EscalationContact {
  id: string;
  name: string;
  /** 10-digit mobile, no country code - displayed with a +91 prefix like every other phone field in this app. */
  phone: string;
  designation?: string;
  isActive: boolean;
  createdAt: string;
}

function seedEscalationContacts(): EscalationContact[] {
  return [];
}

export const escalationContacts = defineCollection<EscalationContact>("escalation-contacts", seedEscalationContacts, 1, {
  supabaseTable: "escalation_contacts",
});

export interface NewEscalationContact {
  name: string;
  phone: string;
  designation?: string;
}

const MOBILE = /^[6-9]\d{9}$/;

/** Field errors for the add-contact form; empty when valid. Also enforced by addEscalationContact. */
export function escalationContactErrors(input: Partial<NewEscalationContact>) {
  const errors: Partial<Record<"name" | "phone", string>> = {};
  if (!input.name?.trim()) errors.name = "Required";
  if (!MOBILE.test(input.phone ?? "")) errors.phone = input.phone ? "Enter a 10-digit mobile number" : "Required";
  return errors;
}

export async function addEscalationContact(input: NewEscalationContact) {
  assertCan("escalation_contacts.manage");
  const errors = escalationContactErrors(input);
  const first = Object.entries(errors)[0];
  if (first) throw new Error(`Blocked: ${first[0]} — ${first[1]}`);
  const all = await escalationContacts.all();
  if (all.some((c) => c.phone === input.phone)) throw new Error("Blocked: a contact with this phone number already exists");
  const contact: EscalationContact = {
    id: newId("esc"),
    name: input.name.trim(),
    phone: input.phone,
    designation: input.designation?.trim() || undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await escalationContacts.add(contact);
  return contact;
}

/** Toggles whether a contact is currently notified, without removing their record. */
export function setEscalationContactActive(id: string, isActive: boolean) {
  assertCan("escalation_contacts.manage");
  return escalationContacts.update(id, (c) => ({ ...c, isActive }));
}

export function deleteEscalationContact(id: string) {
  assertCan("escalation_contacts.manage");
  return escalationContacts.remove(id);
}
