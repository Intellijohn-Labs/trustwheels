import type React from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LIFECYCLE_STAGES } from "@/lib/masters";
import { CountUp } from "./count-up";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  wide,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

const control =
  "h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-faint outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:bg-sunken disabled:text-muted";

export function inputClass(invalid?: boolean) {
  return cn(control, invalid ? "border-danger" : "border-line-strong");
}

export function textareaClass(invalid?: boolean) {
  return cn(control, "h-auto min-h-24 py-3", invalid ? "border-danger" : "border-line-strong");
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex gap-1 rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 flex-1 rounded-lg px-3 text-sm font-medium transition",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const stageTone = (stage: number) =>
  stage >= 11
    ? "bg-sunken text-muted"
    : stage === 10
      ? "bg-ok-soft text-ok"
      : stage >= 7
        ? "bg-brand-soft text-brand"
        : stage >= 5
          ? "bg-warn-soft text-warn"
          : "bg-sunken text-ink";

export function StageBadge({ stage }: { stage: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", stageTone(stage))}>
      {LIFECYCLE_STAGES[stage - 1]}
    </span>
  );
}

// ---- layout & actions shared by every role panel ----------------------------------

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";

const buttonTone: Record<"primary" | "secondary" | "success" | "danger" | "warn" | "ghost", string> = {
  primary: "bg-brand text-surface hover:brightness-110",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  success: "bg-ok text-surface hover:brightness-110",
  danger: "bg-danger text-surface hover:brightness-110",
  warn: "border border-warn/40 bg-warn-soft text-warn hover:brightness-95",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonTone; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : size === "lg" ? "h-12 px-5 text-sm" : "h-10 px-3.5 text-sm",
        buttonTone[variant],
        className,
      )}
    />
  );
}

export function PageHeader({ title, description, icon, actions, tone }: { title: string; description?: ReactNode; icon?: ReactNode; actions?: ReactNode; tone?: "danger" }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className={cn("flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-[1.7rem]", tone === "danger" && "text-danger")}>
          {icon}
          <span className={tone === "danger" ? undefined : "text-gradient"}>{title}</span>
        </h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  tone,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "danger" | "warn";
  /** No inner padding, for tables that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.18)]",
        tone === "danger" ? "border-danger/40" : tone === "warn" ? "border-warn/40" : "border-line",
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className={cn("flex items-center gap-2 text-sm font-semibold", tone === "danger" && "text-danger")}>
                <span aria-hidden className={cn("h-3.5 w-1 shrink-0 rounded-full", tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-brand-gradient")} />
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>;
}

const pillTone: Record<Tone, string> = {
  neutral: "bg-sunken text-ink",
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger text-surface",
};

/** Status label. Always carries text (and ideally an icon), never color alone. */
export function Pill({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", pillTone[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const kpiAccent: Record<Tone, string> = {
  neutral: "text-muted",
  brand: "text-brand",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

/**
 * KPI stat tile: label (sentence case), value, optional context line.
 * `tone` marks a status (warn/danger) and is always paired with the hint text and icon.
 */
export function KpiCard({ label, value, hint, icon, tone = "neutral", href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && (
          <span
            className={cn(
              "kpi-chip grid size-9 shrink-0 place-items-center rounded-xl [&>svg]:size-[18px]",
              tone === "danger" ? "bg-danger-soft text-danger" : tone === "warn" ? "bg-warn-soft text-warn" : tone === "ok" ? "bg-ok-soft text-ok" : "bg-brand-gradient text-surface shadow-sm",
            )}
          >
            <span className={cn("grid place-items-center", tone === "danger" && "wiggle")}>{icon}</span>
          </span>
        )}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tracking-tight", tone === "danger" || tone === "warn" ? kpiAccent[tone] : "text-ink")}>
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = cn(
    "kpi-card block rounded-2xl border bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
    tone === "danger" ? "border-danger/40" : tone === "warn" ? "border-warn/40" : "border-line",
    href && "lift hover:border-line-strong",
  );
  return href ? (
    <Link href={href} className={cls} data-tone={tone}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-tone={tone}>
      {body}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="kpi-grid grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
