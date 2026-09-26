const inr = new Intl.NumberFormat("en-IN");

/** 12500000 paise -> "₹1,25,000" */
export function formatPaise(paise: number) {
  return `₹${inr.format(Math.round(paise / 100))}`;
}

export function groupIndian(digits: string) {
  return digits ? inr.format(Number(digits)) : "";
}

export function formatNumber(n: number) {
  return inr.format(n);
}

/** DD/MM/YYYY in Asia/Kolkata */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** "2026-09-24" -> "24/09/2026" */
export function formatIsoDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

// Indian registration numbers: state code, RTO code, series, number (KL 07 AB 1234),
// plus the Bharat series (22 BH 1234 AA).
const STANDARD = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
const BHARAT = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

export function normaliseReg(input: string) {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidReg(normalised: string) {
  return STANDARD.test(normalised) || BHARAT.test(normalised);
}

/** "KL07AB1234" -> "KL 07 AB 1234" */
export function displayReg(normalised: string) {
  const bh = normalised.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);
  if (bh) return bh.slice(1).join(" ");
  const std = normalised.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/);
  if (std) return std.slice(1).filter(Boolean).join(" ");
  return normalised;
}

// Every prefix a valid number can pass through while being typed.
const STANDARD_PREFIX = /^([A-Z]{1,2}|[A-Z]{2}\d{1,2}|[A-Z]{2}\d{1,2}[A-Z]{1,3}|[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4})$/;
const BHARAT_PREFIX = /^(\d{1,2}|\d{2}B|\d{2}BH\d{0,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;

/** False as soon as the typed characters can no longer become a valid number. */
export function couldBeReg(partial: string) {
  return partial === "" || STANDARD_PREFIX.test(partial) || BHARAT_PREFIX.test(partial);
}
