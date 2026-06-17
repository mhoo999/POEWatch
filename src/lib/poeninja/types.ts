/**
 * Raw response shapes for the poe.ninja PoE2 economy API.
 *
 * NOTE: poe.ninja's PoE2 endpoints are undocumented (discovered via network
 * interception) and may differ from these shapes. Fields are permissive
 * (optional) and the mapper (./map.ts) tolerates missing data. The exact
 * item-overview endpoint/field names must be confirmed at implementation time
 * by inspecting poe.ninja/poe2/economy network requests — see ./client.ts.
 */

/** Price trend mini-series attached to an item line. */
export interface NinjaSparkline {
  data?: Array<number | null>;
  totalChange?: number;
}

/** One row in an item-overview response (a unique, gem, etc.). */
export interface NinjaItemLine {
  id?: number;
  name?: string;
  baseType?: string;
  itemType?: string;
  // Icon URL. poe.ninja PoE1 uses `icon`; PoE2 field name is unconfirmed, so
  // the mapper also probes the alternates below. All point at web.poecdn.com.
  icon?: string;
  iconUrl?: string;
  image?: string;
  itemImageUrl?: string;
  // Price fields (any subset may be present depending on item type).
  chaosValue?: number;
  exaltedValue?: number;
  divineValue?: number;
  // Number of listings observed (effective supply, roughly).
  count?: number;
  listingCount?: number;
  sparkline?: NinjaSparkline;
  // Mods, when present.
  explicitModifiers?: Array<{ text?: string }>;
  implicitModifiers?: Array<{ text?: string }>;
  // Tolerate unknown/renamed fields from the undocumented PoE2 response.
  [key: string]: unknown;
}

export interface NinjaItemOverviewResponse {
  lines?: NinjaItemLine[];
}

/** Currency-exchange overview line (PoE2 currencyexchange endpoint). */
export interface NinjaCurrencyLine {
  currencyTypeName?: string;
  // Value expressed in the base currency (varies by endpoint version).
  chaosEquivalent?: number;
  value?: number;
}

export interface NinjaCurrencyOverviewResponse {
  lines?: NinjaCurrencyLine[];
}
