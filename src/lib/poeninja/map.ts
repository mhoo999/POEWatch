import type { NinjaItemLine } from "./types";
import type { Category } from "@/lib/domain/types";

/**
 * A poe.ninja item line normalized into the fields we persist. poe.ninja is
 * an AGGREGATE source (one row per item, not per listing), so price/count are
 * already summarized.
 */
export interface NinjaMappedItem {
  /** Stable id for idempotent upserts: `ninja-{league}-{type}-{id|name}`. */
  rawHash: string;
  name: string;
  baseType: string;
  category: Category;
  iconUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  /** Number of listings observed (rough effective supply). */
  count: number;
}

/** Map a poe.ninja item-type label to our Category enum. */
function categoryForType(itemType: string): Category {
  switch (itemType) {
    case "UniqueWeapon":
      return "WEAPON";
    case "UniqueArmour":
      return "ARMOUR";
    case "UniqueAccessory":
      return "AMULET"; // accessories are mixed; AMULET is the closest single bucket
    default:
      return "OTHER";
  }
}

/** Pick a representative price + currency, preferring the lower-denomination unit. */
function pickPrice(line: NinjaItemLine): { amount: number | null; currency: string | null } {
  if (typeof line.chaosValue === "number") return { amount: line.chaosValue, currency: "chaos" };
  if (typeof line.exaltedValue === "number") return { amount: line.exaltedValue, currency: "exalted" };
  if (typeof line.divineValue === "number") return { amount: line.divineValue, currency: "divine" };
  return { amount: null, currency: null };
}

/**
 * Convert a raw poe.ninja line into our persistable shape. Returns null when
 * the line lacks the minimum identity (a name).
 */
export function mapNinjaLine(
  line: NinjaItemLine,
  itemType: string,
  league: string,
): NinjaMappedItem | null {
  const name = line.name?.trim();
  if (!name) return null;

  const baseType = line.baseType?.trim() || name;
  const price = pickPrice(line);
  const idPart = line.id ?? name;

  return {
    rawHash: `ninja-${league}-${itemType}-${idPart}`,
    name,
    baseType,
    category: categoryForType(itemType),
    iconUrl: line.icon ?? null,
    priceAmount: price.amount,
    priceCurrency: price.currency,
    count: line.count ?? line.listingCount ?? 0,
  };
}
