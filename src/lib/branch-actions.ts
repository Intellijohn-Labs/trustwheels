import { BRANCHES } from "./masters";
import { writeBranchName } from "./branch-names";
import { assertCan } from "./session";

/** Rename a branch (Settings → Branches). Pass the default name, or blank, to restore it. */
export async function renameBranch(id: string, name: string) {
  assertCan("settings.manage");
  const branch = BRANCHES.find((b) => b.id === id);
  if (!branch) throw new Error("Branch not found");
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean && clean.length < 2) throw new Error("Enter a branch name (at least 2 letters)");
  if (clean.length > 40) throw new Error("Branch name is too long (40 characters max)");
  const clash = BRANCHES.find((b) => b.id !== id && b.name.toLowerCase() === clean.toLowerCase());
  if (clash) throw new Error(`Blocked: "${clean}" is already used by another branch`);
  writeBranchName(id, clean && clean !== branch.defaultName ? clean : undefined);
}
