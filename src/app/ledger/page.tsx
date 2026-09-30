import { redirect } from "next/navigation";

// The Ledger feature has been removed. Anyone with this URL bookmarked or linked lands on the dashboard instead of a 404.
export default function LedgerPage() {
  redirect("/dashboard");
}
