import type { TradeFetchResult } from "./types";
import type { Category, NormalizedListing } from "@/lib/domain/types";
import { normalizeMods } from "@/lib/normalize/normalize";

/** Map a POE rarity string to our enum value. */
function mapRarity(rarity?: string): NormalizedListing["rarity"] {
  switch ((rarity ?? "").toLowerCase()) {
    case "normal":
      return "NORMAL";
    case "magic":
      return "MAGIC";
    case "rare":
      return "RARE";
    case "unique":
      return "UNIQUE";
    default:
      return "UNKNOWN";
  }
}

/**
 * Convert a raw trade fetch result into our internal NormalizedListing.
 * `category` is supplied by the collector since it knows which query ran.
 */
export function mapFetchResult(
  raw: TradeFetchResult,
  category: Category,
): NormalizedListing | null {
  const item = raw.item;
  if (!item) return null;

  const baseType = item.baseType ?? item.typeLine ?? "Unknown";
  // For rares/whites the "name" is empty — fall back to the base type.
  const itemName = item.name && item.name.length > 0 ? item.name : baseType;

  const rawMods = [
    ...(item.explicitMods ?? []),
    ...(item.implicitMods ?? []),
    ...(item.runeMods ?? []),
  ];

  const price = raw.listing?.price ?? null;
  const indexed = raw.listing?.indexed;

  return {
    rawHash: raw.id,
    league: "", // filled in by the collector (it owns the league context)
    itemName,
    baseType,
    category,
    rarity: mapRarity(item.rarity),
    iconUrl: item.icon ?? null,
    sellerAccount: raw.listing?.account?.name ?? null,
    priceAmount: price?.amount ?? null,
    priceCurrency: price?.currency ?? null,
    listedAt: indexed ? new Date(indexed) : null,
    mods: normalizeMods(rawMods),
  };
}
