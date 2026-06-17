/**
 * poe.ninja constants — a dependency-free leaf module.
 *
 * Kept separate from client.ts so the runtime value can be imported without
 * pulling in the client (and so esbuild/tsx CJS interop can't leave the `as
 * const` array undefined across a module boundary, which manifested as
 * "NINJA_ITEM_TYPES is not iterable").
 */

/** PoE2 item-overview categories worth ingesting first (uniques). */
export const NINJA_ITEM_TYPES = [
  "UniqueWeapon",
  "UniqueArmour",
  "UniqueAccessory",
  "UniqueFlask",
  "UniqueJewel",
] as const;

export type NinjaItemType = (typeof NINJA_ITEM_TYPES)[number];
