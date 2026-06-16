/**
 * Normalized mod keys and the rules that map raw POE2 mod text to them.
 *
 * PRD §3.3: item options are normalized into stable keys so they can be
 * grouped and analyzed (e.g. classifying Physical vs Crit bows in §3.4).
 *
 * This is the FOUNDATION: it covers the bow-relevant mods needed to prove
 * the pipeline. Later phases extend the rule list to cover more categories.
 */

export const MOD_KEYS = [
  "PHYSICAL_DAMAGE",
  "FLAT_PHYSICAL_DAMAGE",
  "CRITICAL_CHANCE",
  "CRITICAL_DAMAGE_BONUS",
  "ATTACK_SPEED",
  "PROJECTILE_LEVEL",
  "COLD_DAMAGE",
  "LIGHTNING_DAMAGE",
  "FIRE_DAMAGE",
  "GEM_LEVEL",
] as const;

export type ModKey = (typeof MOD_KEYS)[number];

/** Display + grouping metadata for each key (mirrors ModDefinition rows). */
export const MOD_DEFINITIONS: Record<
  ModKey,
  { displayName: string; group: string; unit: string }
> = {
  PHYSICAL_DAMAGE: { displayName: "Increased Physical Damage", group: "PHYSICAL", unit: "%" },
  FLAT_PHYSICAL_DAMAGE: { displayName: "Added Physical Damage", group: "PHYSICAL", unit: "flat" },
  CRITICAL_CHANCE: { displayName: "Critical Hit Chance", group: "CRIT", unit: "%" },
  CRITICAL_DAMAGE_BONUS: { displayName: "Critical Damage Bonus", group: "CRIT", unit: "%" },
  ATTACK_SPEED: { displayName: "Attack Speed", group: "SPEED", unit: "%" },
  PROJECTILE_LEVEL: { displayName: "Level of Projectile Skills", group: "GEM", unit: "flat" },
  GEM_LEVEL: { displayName: "Level of all Gems", group: "GEM", unit: "flat" },
  COLD_DAMAGE: { displayName: "Added Cold Damage", group: "ELEMENTAL", unit: "flat" },
  LIGHTNING_DAMAGE: { displayName: "Added Lightning Damage", group: "ELEMENTAL", unit: "flat" },
  FIRE_DAMAGE: { displayName: "Added Fire Damage", group: "ELEMENTAL", unit: "flat" },
};

/**
 * Ordered rule list. The first matching rule wins, so more-specific patterns
 * must come before more-general ones. `valueGroup` is the regex capture group
 * holding the numeric value to extract (for ranges like "5-12" we average).
 */
export interface ModRule {
  key: ModKey;
  regex: RegExp;
  valueGroup: number;
}

export const MOD_RULES: ModRule[] = [
  // Crit — must precede generic "damage" matches.
  { key: "CRITICAL_DAMAGE_BONUS", regex: /([\d.]+)%\s+increased\s+critical\s+(?:damage\s+bonus|strike\s+damage)/i, valueGroup: 1 },
  { key: "CRITICAL_CHANCE", regex: /([\d.]+)%\s+increased\s+critical\s+(?:hit\s+chance|strike\s+chance)/i, valueGroup: 1 },
  // Attack speed.
  { key: "ATTACK_SPEED", regex: /([\d.]+)%\s+increased\s+attack\s+speed/i, valueGroup: 1 },
  // Gem / projectile levels.
  { key: "PROJECTILE_LEVEL", regex: /\+(\d+)\s+to\s+level\s+of\s+all\s+projectile/i, valueGroup: 1 },
  { key: "GEM_LEVEL", regex: /\+(\d+)\s+to\s+level\s+of\s+all\s+(?:skill\s+gems|gems)/i, valueGroup: 1 },
  // Elemental added damage (ranges -> averaged in normalize()).
  { key: "COLD_DAMAGE", regex: /adds\s+(\d+)\s+to\s+(\d+)\s+cold\s+damage/i, valueGroup: 1 },
  { key: "LIGHTNING_DAMAGE", regex: /adds\s+(\d+)\s+to\s+(\d+)\s+lightning\s+damage/i, valueGroup: 1 },
  { key: "FIRE_DAMAGE", regex: /adds\s+(\d+)\s+to\s+(\d+)\s+fire\s+damage/i, valueGroup: 1 },
  // Physical.
  { key: "FLAT_PHYSICAL_DAMAGE", regex: /adds\s+(\d+)\s+to\s+(\d+)\s+physical\s+damage/i, valueGroup: 1 },
  { key: "PHYSICAL_DAMAGE", regex: /([\d.]+)%\s+increased\s+physical\s+damage/i, valueGroup: 1 },
];
