/**
 * Response shapes for the Exiled Exchange 2 (EE2) poe.ninja PoE2 proxy.
 *
 *   GET https://api.exiledexchange2.dev/proxy/{slug}/overviewData.json
 *   slug ∈ league | leaguehc | standard | standardhc
 *
 * EE2 mirrors poe.ninja's PoE2 economy into a single CDN-cached JSON covering
 * every category (currency + all unique buckets) in one request. This avoids
 * poe.ninja's Cloudflare gating and per-endpoint rate limits. Shapes below were
 * confirmed against live data (see src/lib/poeninja/client.ts header).
 *
 * Prices: every `primaryValue` is denominated in `core.primary` (Divine Orb).
 * `core.rates` gives how many of each currency equal ONE primary unit, e.g.
 * { exalted: 177.8, chaos: 12.34 } ⇒ 1 divine = 177.8 exalted = 12.34 chaos.
 */

/** Price trend mini-series attached to a line. */
export interface NinjaSparkline {
  data?: Array<number | null>;
  totalChange?: number;
}

/** One row in an item/currency overview (a unique, an orb, etc.). */
export interface NinjaLine {
  name?: string;
  /** Base/variant label, e.g. "Scimitar" for The Dancing Dervish. */
  variant?: string;
  /** Price in the primary currency (Divine Orb). */
  primaryValue?: number;
  /** Stable slug poe.ninja uses for the detail page, e.g. "the-dancing-dervish". */
  detailsId?: string;
  id?: number;
  sparkline?: NinjaSparkline;
}

/** A category block within the proxy payload. `type` is plural, e.g. "UniqueWeapons". */
export interface NinjaOverview {
  type: string;
  lines: NinjaLine[];
}

/** Conversion context shared by the whole payload. */
export interface NinjaCore {
  /** Units of each currency per ONE `primary`. */
  rates: Record<string, number>;
  /** The currency `primaryValue` is expressed in (e.g. "divine"). */
  primary: string;
  secondary?: string;
}

/** Top-level EE2 proxy response. */
export interface NinjaProxyResponse {
  core: NinjaCore;
  itemOverviews: NinjaOverview[];
}
