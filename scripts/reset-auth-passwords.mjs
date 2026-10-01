#!/usr/bin/env node
/*
 * Admin-only utility: list Supabase Auth users, and optionally set a known temporary password
 * for some or all of them. Requires the project's SERVICE ROLE key - which this script reads
 * from an environment variable, never hardcodes, and never sends anywhere but Supabase's own API.
 *
 * This is deliberately NOT part of the Next.js app (nothing under src/) and must stay that way:
 * the service role key bypasses every RLS policy in the project, so it must never end up in a
 * client bundle, a NEXT_PUBLIC_* var, or committed to git. Run it from your own machine only.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-auth-passwords.mjs --list
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-auth-passwords.mjs --all --password="TrustWheels@123"
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/reset-auth-passwords.mjs --emails=a@x.com,b@y.com --password="TrustWheels@123"
 *
 * With no --all or --emails flag, it only lists users (read-only) - it never resets a password
 * unless you explicitly ask it to.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the service role key, from Supabase Dashboard -> Project Settings -> API) before running this.");
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => {
  const a = flag(name);
  if (!a) return undefined;
  const eq = a.indexOf("=");
  return eq === -1 ? true : a.slice(eq + 1);
};

const all = !!flag("all");
const emailsArg = flagValue("emails");
const targetEmails = emailsArg ? emailsArg.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) : null;
const password = flagValue("password") || "TrustWheels@123";

if (!all && !targetEmails) {
  console.log("No --all or --emails given - listing registered users only (read-only).\n");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function main() {
  const users = await listAllUsers();

  console.log(`Registered Supabase Auth users (${users.length}):`);
  for (const u of users.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    console.log(`  ${u.email ?? "(no email)"}  ·  created ${u.created_at}  ·  confirmed ${u.email_confirmed_at ? "yes" : "no"}  ·  id ${u.id}`);
  }
  console.log("");

  if (!all && !targetEmails) return;

  const targets = all ? users : users.filter((u) => u.email && targetEmails.includes(u.email.toLowerCase()));
  if (targetEmails) {
    const found = new Set(targets.map((u) => u.email.toLowerCase()));
    for (const e of targetEmails) if (!found.has(e)) console.warn(`No registered user found for ${e} - skipped.`);
  }
  if (targets.length === 0) {
    console.log("Nothing to reset.");
    return;
  }

  console.log(`Setting a temporary password for ${targets.length} user(s)...\n`);
  const results = [];
  for (const u of targets) {
    const { error } = await admin.auth.admin.updateUserById(u.id, { password });
    results.push({ email: u.email, ok: !error, error: error?.message });
  }

  console.log("email,temporary_password,status");
  for (const r of results) {
    console.log(`${r.email},${r.ok ? password : ""},${r.ok ? "ok" : `FAILED: ${r.error}`}`);
  }
  console.log("\nTell each person to sign in with this temporary password and use \"Forgot password?\" on /login to set their own right after.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
