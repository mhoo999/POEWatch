import { MOD_RULES, type ModRule } from "./modKeys";
import type { NormalizedMod } from "@/lib/domain/types";

/**
 * Extract the numeric value for a matched rule. For "adds X to Y" ranges we
 * average the two numbers; otherwise we take the captured group.
 */
function extractValue(rule: ModRule, match: RegExpMatchArray): number | null {
  const primary = match[rule.valueGroup];
  if (primary === undefined) return null;
  const lo = Number(primary);
  // Range pattern: a second numeric capture group immediately follows.
  const next = match[rule.valueGroup + 1];
  if (next !== undefined && /^\d/.test(next)) {
    const hi = Number(next);
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) return (lo + hi) / 2;
  }
  return Number.isNaN(lo) ? null : lo;
}

/** Map a single raw mod line to a normalized key + value (null key if unmatched). */
export function normalizeMod(rawText: string): NormalizedMod {
  for (const rule of MOD_RULES) {
    const match = rawText.match(rule.regex);
    if (match) {
      return { rawText, modKey: rule.key, value: extractValue(rule, match) };
    }
  }
  return { rawText, modKey: null, value: null };
}

/** Normalize a list of raw mod lines (PRD §3.3). */
export function normalizeMods(rawTexts: string[]): NormalizedMod[] {
  return rawTexts.map(normalizeMod);
}
