"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Bike,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarRange,
  ChartColumn,
  CloudOff,
  FileSpreadsheet,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutList,
  Megaphone,
  PackageCheck,
  PhoneCall,
  PiggyBank,
  Plane,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Truck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  Check,
  Circle,
  Loader2,
  Menu,
  MapPin,
  X,
  type LucideIcon,
} from "lucide-react";
import { BRANCHES } from "@/lib/masters";
import { NAV_GROUPS, ROUTES, findRoute } from "@/lib/rbac";
import { useRole } from "@/lib/role-context";
import { useNavBadges } from "@/lib/nav-badges";
import { drain, useSyncStatus, type SyncStatus } from "@/lib/sync-queue";
import { supabase } from "@/lib/supabase";
import { SignOutButton } from "./sign-out-button";
import { Forbidden } from "./forbidden";
import { RoleSwitcher } from "./role-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { cn } from "./ui";

// Pages reached from the gear button.
const SETTINGS_PATHS = ["/settings", "/team", "/branches"];

// Full-screen pages that bring their own layout - and that never require a session to reach.
// /reset-password is reachable with only a short-lived recovery session (or none yet, while the
// link's tokens are still being parsed from the URL), which the guard below must not mistake for
// "not logged in, redirect away" or "fully authed, let them anywhere".
const BARE = ["/login", "/signup", "/forgot-password", "/reset-password"];

const ICONS: Record<string, LucideIcon> = { ArrowLeftRight, BadgeCheck, Bike, BookOpen, Building2, CalendarCheck, CalendarRange, ChartColumn, FileSpreadsheet, KeyRound, Landmark, LayoutDashboard, LayoutList, MapPin, Megaphone, PackageCheck, PhoneCall, PiggyBank, Plane, Plus, ShieldCheck, Siren, TriangleAlert, Truck, UserCog, UserPlus, Users, Wallet, Wrench };

function RouteIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className} />;
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { canOpenRoute } = useRole();
  const badges = useNavBadges();
  const visible = ROUTES.filter((r) => !r.hidden && canOpenRoute(r));
  const active = findRoute(pathname);

  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <Link href="/dashboard" onClick={onNavigate} aria-label="Trust Wheels dashboard" className="flex h-20 shrink-0 items-center px-5">
        <Logo className="h-14 w-auto" />
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = visible.filter((r) => r.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">{group}</p>
              <ul className="space-y-0.5">
                {items.map((r) => {
                  const isActive = active?.path === r.path || (r.path === "/stock" && active?.path === "/stock/[id]");
                  const badge = badges[r.path];
                  return (
                    <li key={r.path}>
                      <Link
                        href={r.path}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                          isActive ? "nav-active" : "text-muted hover:translate-x-0.5 hover:bg-sunken hover:text-ink",
                        )}
                      >
                        <RouteIcon name={r.icon} className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{r.label}</span>
                        {badge ? (
                          <span
                            className={cn(
                              "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                              badge.tone === "danger" ? "pulse-danger bg-danger text-surface" : "bg-warn-soft text-warn",
                            )}
                            title={badge.title}
                          >
                            {badge.count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="space-y-0.5 border-t border-line p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={SETTINGS_PATHS.includes(pathname) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
            SETTINGS_PATHS.includes(pathname) ? "nav-active" : "text-muted hover:bg-sunken hover:text-ink",
          )}
        >
          <Settings className="size-4" /> Settings
        </Link>
        <SignOutButton
          onNavigate={onNavigate}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-sunken hover:text-ink"
        />
      </div>
    </nav>
  );
}

const SYNC_STATUS: Record<SyncStatus, { dot: string; text: string; label: string; title: string; icon: LucideIcon }> = {
  synced: { dot: "bg-ok", text: "text-ok", label: "Synced", title: "Everything is synced to the cloud", icon: Check },
  syncing: { dot: "bg-warn animate-pulse", text: "text-warn", label: "Syncing…", title: "Syncing with the cloud…", icon: RefreshCw },
  offline: { dot: "bg-faint", text: "text-muted", label: "Offline", title: "Offline - saved on this device, will sync once you're back online", icon: CloudOff },
  "not-configured": {
    dot: "bg-danger",
    text: "text-danger",
    label: "Local only",
    title: "Not connected to the shared database on this deployment - changes made here stay on this device only and won't appear on others until Supabase is configured",
    icon: TriangleAlert,
  },
};

function SyncStatusPill() {
  const status = useSyncStatus();
  const s = SYNC_STATUS[status];
  const Icon = s.icon;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium" title={s.title}>
      <span className={cn("size-2 shrink-0 rounded-full", s.dot)} />
      <Icon className={cn("size-3 shrink-0 sm:hidden", s.text, status === "syncing" && "animate-spin")} />
      <span className={cn("hidden sm:inline", s.text)}>{s.label}</span>
    </span>
  );
}

/**
 * Manual "sync now": pulls fresh data from Supabase for every collection currently in use (via
 * the shared `tw:refresh` event every collection listens for once mounted) and flushes any writes
 * still stuck in the local retry queue. The quick workaround for "my other device shows different
 * data" without waiting for a tab to regain focus or come back online on its own.
 */
function RefreshButton() {
  const [spinning, setSpinning] = useState(false);

  async function refresh() {
    if (spinning) return;
    setSpinning(true);
    window.dispatchEvent(new Event("tw:refresh"));
    await drain();
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <button
      type="button"
      onClick={refresh}
      aria-label="Refresh data"
      title="Refresh data from the cloud"
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface text-muted transition hover:bg-sunken hover:text-ink"
    >
      <RefreshCw className={cn("size-4", spinning && "animate-spin")} />
    </button>
  );
}

function ScopeChip() {
  const { roleDef } = useRole();
  const label = roleDef.scope === "all" ? "All branches" : roleDef.scope.map((id) => BRANCHES.find((b) => b.id === id)?.name ?? id).join(", ");
  return (
    <span className="hidden min-w-0 items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-xs font-medium text-muted md:inline-flex" title="Data you can see">
      <MapPin className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

// Same dev/production split as the role switcher (role-switcher.tsx): a local `pnpm dev` keeps
// testing every role without a real sign-in for each one, compiled out of production entirely.
const DEV_NO_AUTH_GATE = process.env.NODE_ENV === "development";

/**
 * Real session gate: every route other than /login and /signup requires an active Supabase Auth
 * session, checked client-side (this app has no server-rendered/middleware auth layer) on mount
 * and kept live via onAuthStateChange, so a session that ends elsewhere (sign-out in another tab,
 * expiry) redirects here too, not just a stale page that happens to still show the old role.
 * Falls back to "no gate" when Supabase isn't configured at all - there's no backend to check a
 * session against, so blocking here would just lock the app out with no way back in.
 */
function useSessionGuard(pathname: string) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(DEV_NO_AUTH_GATE || !supabase ? true : null);

  useEffect(() => {
    if (DEV_NO_AUTH_GATE || !supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => active && setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setAuthed(!!session));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authed === false && !BARE.includes(pathname)) router.replace("/login");
  }, [authed, pathname, router]);

  return authed;
}

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-page">
      <Loader2 className="size-6 animate-spin text-muted" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, canOpenRoute } = useRole();
  const [drawer, setDrawer] = useState(false);
  const authed = useSessionGuard(pathname);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  if (BARE.includes(pathname)) return <>{children}</>;

  // Still checking, or known signed-out and about to be redirected - never flash protected
  // content in either case.
  if (authed !== true) return <FullScreenLoader />;

  const route = findRoute(pathname);
  const allowed = !route || canOpenRoute(route);

  return (
    <div className="relative min-h-dvh lg:pl-64">
      <div aria-hidden className="aurora-bg" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface bg-[linear-gradient(180deg,var(--brand-soft),transparent_40%)] lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="anim-overlay absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="anim-drawer absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute top-4 right-3 grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken">
              <X className="size-5" />
            </button>
            <Sidebar pathname={pathname} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-sunken lg:hidden">
            <Menu className="size-5" />
          </button>
          <Link href="/dashboard" aria-label="Trust Wheels dashboard" className="flex items-center lg:hidden">
            <Logo className="h-9 w-auto min-[400px]:h-10" />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <SyncStatusPill />
            <RefreshButton />
            <ScopeChip />
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className={cn(
                "group grid size-10 shrink-0 place-items-center rounded-xl border transition",
                SETTINGS_PATHS.includes(pathname) ? "nav-active border-transparent" : "border-line-strong bg-surface text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <Settings className="size-[18px] transition-transform duration-500 group-hover:rotate-90" />
            </Link>
            <ThemeToggle />
            <RoleSwitcher />
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6">
        {/* Keyed by path so each page's blocks rise in on navigation. */}
        <div key={`${pathname}:${role}`} className="page-enter">
          {allowed ? children : <Forbidden route={route!} />}
        </div>
      </main>
    </div>
  );
}
