/**
 * Raw response shapes for the POE2 trade API (trade2).
 *
 * NOTE: GGG only officially documents the public-stash/league APIs. These
 * `trade2` search/fetch endpoints are the same ones the official trade site
 * calls; the shapes below cover the fields we consume and are intentionally
 * permissive (lots of optionals) since the API is undocumented and changes.
 */

/** POST /api/trade2/search/{league} response. */
export interface TradeSearchResponse {
  id: string; // query id, needed for fetch
  complexity?: number | null;
  result: string[]; // listing hashes (<= 100)
  total: number;
}

/** A price block on a listing. */
export interface TradePrice {
  type?: string; // e.g. "~price"
  amount?: number;
  currency?: string; // e.g. "exalted", "divine"
}

export interface TradeListingInfo {
  indexed?: string; // ISO timestamp when listed
  account?: { name?: string };
  price?: TradePrice | null;
}

export interface TradeItemProperty {
  name?: string;
  values?: Array<[string, number]>;
}

export interface TradeItem {
  name?: string; // unique/rare name (may be empty for white items)
  typeLine?: string; // base type
  baseType?: string;
  icon?: string;
  rarity?: string; // "Normal" | "Magic" | "Rare" | "Unique"
  identified?: boolean;
  ilvl?: number;
  properties?: TradeItemProperty[];
  explicitMods?: string[];
  implicitMods?: string[];
  runeMods?: string[];
  enchantMods?: string[];
}

/** One entry in GET /api/trade2/fetch response. */
export interface TradeFetchResult {
  id: string; // the listing hash
  listing?: TradeListingInfo;
  item?: TradeItem;
}

export interface TradeFetchResponse {
  result: Array<TradeFetchResult | null>;
}

/** A trade search query body (we only build a small subset of filters). */
export interface TradeQueryBody {
  query: {
    status?: { option: "online" | "onlineleague" | "any" };
    type?: string;
    name?: string;
    stats?: Array<{ type: string; filters: unknown[] }>;
    filters?: Record<string, unknown>;
  };
  sort?: Record<string, "asc" | "desc">;
}
