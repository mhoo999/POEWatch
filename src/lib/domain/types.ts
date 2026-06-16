/**
 * Shared domain types used across the collector, API routes, and UI.
 * These are deliberately decoupled from both the raw POE API shape
 * (see src/lib/poe/types.ts) and the Prisma models, so each layer can
 * evolve independently.
 */

export type Category =
  | "BOW"
  | "BELT"
  | "AMULET"
  | "RING"
  | "UNIQUE"
  | "WEAPON"
  | "ARMOUR"
  | "OTHER";

/** A mod after normalization (raw text -> stable key + numeric value). */
export interface NormalizedMod {
  rawText: string;
  modKey: string | null;
  value: number | null;
}

/** A trade listing in our normalized internal form, ready to persist. */
export interface NormalizedListing {
  rawHash: string;
  league: string;
  itemName: string;
  baseType: string;
  category: Category;
  rarity: "NORMAL" | "MAGIC" | "RARE" | "UNIQUE" | "UNKNOWN";
  iconUrl: string | null;
  sellerAccount: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  listedAt: Date | null;
  mods: NormalizedMod[];
}

/** Item summary returned by GET /api/items/search. */
export interface ItemSearchResult {
  id: string;
  name: string;
  baseType: string;
  category: Category;
  medianPrice: number | null;
  validListings: number;
  totalListings: number;
}

/** A single row in the Meta Radar response (GET /api/meta/radar). */
export interface MetaRadarPoint {
  group: string;
  share: number;
  sampleN: number;
  ts: string;
}

/** A single row in the Hot Market response (GET /api/market/hot). */
export interface HotMarketEntry {
  itemId: string;
  name: string;
  changePct: number;
  metric: "PRICE" | "SUPPLY" | "VALID_SUPPLY";
}
