"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Check, ChevronRight, Monitor, Moon, Palette, Settings, Sun, UserCog } from "lucide-react";
import { BRANCHES } from "@/lib/masters";
import { ROLE_ORDER, DEMO_USERS } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { ACCENTS, setAccent, useAccent } from "@/components/accent-picker";
import { setTheme, useThemeChoice, type ThemeChoice } from "@/components/theme-toggle";
import { PageHeader, Panel, cn } from "@/components/ui";

const THEMES: { id: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", hint: "Bright, for daytime", icon: Sun },
  { id: "dark", label: "Dark", hint: "Easier on the eyes at night", icon: Moon },
  { id: "system", label: "System", hint: "Follow this device", icon: Monitor },
];

/** Settings hub: appearance for everyone; organisation setup for the Proprietor and HR / Admin. */
export default function SettingsPage() {
  const { can, nameOf } = useRole();
  const theme = useThemeChoice();
  const accent = useAccent();
  const renamedRoles = ROLE_ORDER.filter((r) => nameOf(r) !== DEMO_USERS[r].name).length;
  const renamedBranches = BRANCHES.filter((b) => b.name !== b.defaultName).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" icon={<Settings className="size-6 text-brand" />} description="Personalise how the app looks, and set up names for your team and branches." />

      <Panel title="Appearance" description="Only changes this device. Everyone can pick their own.">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Theme</legend>
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 sm:max-w-lg">
              {THEMES.map((t) => {
                const on = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition",
                      on ? "border-brand bg-brand-soft ring-2 ring-brand/30" : "border-line-strong hover:bg-sunken",
                    )}
                  >
                    <t.icon className={cn("size-5", on ? "text-brand" : "text-muted")} />
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="hidden text-[11px] leading-tight text-muted sm:block">{t.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Palette className="size-4 text-muted" /> Colour theme
            </legend>
            <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ACCENTS.map((a) => {
                const on = accent === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAccent(a.id)}
                    className={cn("group overflow-hidden rounded-xl border text-left transition", on ? "border-brand ring-2 ring-brand/30" : "border-line-strong hover:border-line-strong hover:shadow-sm")}
                  >
                    <span className="block h-14 transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` }} />
                    <span className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
                      {a.label}
                      {on && <Check className="size-4 text-brand" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Panel>

      {can("settings.manage") && (
        <Panel title="Organisation" description="Names used across the whole app. Records stay linked when you rename.">
          <div className="grid gap-3 md:grid-cols-2">
            <SettingLink
              href="/team"
              icon={<UserCog className="size-5" />}
              title="Team & roles"
              text={`Change the name shown for each of the ${ROLE_ORDER.length} roles, e.g. Supervisor or HR.`}
              meta={renamedRoles ? `${renamedRoles} renamed` : "Default names"}
            />
            <SettingLink
              href="/branches"
              icon={<Building2 className="size-5" />}
              title="Branches"
              text={`Rename the ${BRANCHES.length - 1} branches and the Angamaly hub.`}
              meta={renamedBranches ? `${renamedBranches} renamed` : "Default names"}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

function SettingLink({ href, icon, title, text, meta }: { href: string; icon: ReactNode; title: string; text: string; meta: string }) {
  return (
    <Link href={href} className="lift kpi-card group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="kpi-chip bg-brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-surface shadow-sm">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
        <span className="mt-1 block text-xs font-medium text-brand">{meta}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}
