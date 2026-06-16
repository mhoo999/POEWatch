import type { TradeQueryBody } from "./types";

/**
 * Search query builders (PRD Phase 1 targets bows first).
 *
 * The scaffold ships one concrete query — bow bases — so the collector has a
 * real, runnable end-to-end path. Later phases add belts, amulets, uniques, etc.
 */

/** Bow listings, cheapest first, online sellers only. */
export function bowQuery(): TradeQueryBody {
  return {
    query: {
      status: { option: "online" },
      // In POE2, "Bow" is the item class. Using a type filter keeps the result
      // set focused on bow bases regardless of name.
      filters: {
        type_filters: {
          filters: {
            category: { option: "weapon.bow" },
          },
        },
      },
    },
    sort: { price: "asc" },
  };
}

/** A named-unique query (e.g. "Mageblood") for the Phase 1 unique targets. */
export function uniqueByNameQuery(name: string): TradeQueryBody {
  return {
    query: {
      status: { option: "online" },
      name,
      filters: {
        type_filters: {
          filters: { rarity: { option: "unique" } },
        },
      },
    },
    sort: { price: "asc" },
  };
}
