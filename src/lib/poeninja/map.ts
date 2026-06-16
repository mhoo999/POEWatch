import type { NinjaLine } from "./types";
import type { Category } from "@/lib/domain/types";

/**
 * A proxy line normalized into the fields we persist. EE2/poe.ninja is an
 * AGGREGATE source (one row per unique, not per listing), so the price is
 * already summarized. Note the proxy carries NO icon and NO listing/supply
 * count, so those are absent here (iconUrl stays null; supply handled upstream).
 */
export interface NinjaMappedItem {
  /** Stable id for idempotent upserts: `ninja-{slug}-{type}-{detailsId|name}`. */
  rawHash: string;
  name: string;
  baseType: string;
  category: Category;
  iconUrl: string | null;
  /** Price in Divine Orbs (the proxy's `primaryValue`); null when unpriced. */
  priceDivine: number | null;
}

/** Map a proxy (plural) unique `type` label to our Category enum. */
function categoryForType(itemType: string): Category {
  switch (itemType) {
    case "UniqueWeapons":
      return "WEAPON";
    case "UniqueArmours":
      return "ARMOUR";
    case "UniqueAccessories":
      return "AMULET"; // accessories are mixed; AMULET is the closest single bucket
    default:
      // Flasks, Charms, Jewels, Tablets, SanctumRelics, …
      return "OTHER";
  }
}

/**
 * Convert a raw proxy line into our persistable shape. Returns null when the
 * line lacks the minimum identity (a name).
 */
export function mapNinjaLine(
  line: NinjaLine,
  itemType: string,
  slug: string,
): NinjaMappedItem | null {
  const name = line.name?.trim();
  if (!name) return null;

  const variant = line.variant?.trim();
  const baseType = variant || name;
  const idPart = line.detailsId ?? name;

  return {
    rawHash: `ninja-${slug}-${itemType}-${idPart}`,
    name,
    baseType,
    category: categoryForType(itemType),
    iconUrl: null,
    priceDivine: typeof line.primaryValue === "number" ? line.primaryValue : null,
  };
}
