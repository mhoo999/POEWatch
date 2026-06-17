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
 * Extract an icon URL, tolerating renamed fields and relative paths. The PoE2
 * response field name is undocumented, so we probe several candidates and fall
 * back to scanning any string value that looks like a poecdn image URL.
 */
export function pickIconUrl(line: NinjaItemLine): string | null {
  const candidates = [line.icon, line.iconUrl, line.image, line.itemImageUrl];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return normalizeIconUrl(c.trim());
  }
  // Last resort: any string field pointing at the POE image CDN.
  for (const v of Object.values(line)) {
    if (typeof v === "string" && /poecdn\.com|web\.poecdn|gen\/image/i.test(v)) {
      return normalizeIconUrl(v.trim());
    }
  }
  return null;
}

/** Prefix protocol-relative / path-only icon URLs so <img> can load them. */
function normalizeIconUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://web.poecdn.com${url}`;
  return url;
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
    iconUrl: pickIconUrl(line),
    priceAmount: price.amount,
    priceCurrency: price.currency,
    count: line.count ?? line.listingCount ?? 0,
  };
}
