/**
 * Seed reference data + a small sample so the dashboard renders before (or
 * instead of) a successful live collection run.
 *   npm run db:seed
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { MOD_DEFINITIONS } from "@/lib/normalize/modKeys";

async function seedModDefinitions() {
  for (const [modKey, def] of Object.entries(MOD_DEFINITIONS)) {
    await prisma.modDefinition.upsert({
      where: { modKey },
      create: { modKey, displayName: def.displayName, group: def.group, unit: def.unit },
      update: { displayName: def.displayName, group: def.group, unit: def.unit },
    });
  }
  console.log(`[seed] mod definitions: ${Object.keys(MOD_DEFINITIONS).length}`);
}

async function seedCurrencyRates(league: string) {
  // Static placeholder rates (PRD §3.6 통화 환산). Base currency: exalted.
  const rates: Array<{ currency: string; base: string; rate: number }> = [
    { currency: "divine", base: "exalted", rate: 320 },
    { currency: "chaos", base: "exalted", rate: 0.1 },
    { currency: "exalted", base: "exalted", rate: 1 },
  ];
  for (const r of rates) {
    await prisma.currencyRate.upsert({
      where: { league_currency_base: { league, currency: r.currency, base: r.base } },
      create: { league, ...r },
      update: { rate: r.rate },
    });
  }
  console.log(`[seed] currency rates: ${rates.length}`);
}

async function seedSampleBows(league: string) {
  // Two illustrative bow items + one listing each, so /search has content
  // without hitting the live API. Safe to delete once collection works.
  const samples = [
    {
      name: "Sample Recurve Bow (Physical)",
      baseType: "Recurve Bow",
      price: 5,
      mods: [
        { rawText: "120% increased Physical Damage", modKey: "PHYSICAL_DAMAGE", value: 120 },
        { rawText: "Adds 8 to 15 Physical Damage", modKey: "FLAT_PHYSICAL_DAMAGE", value: 11.5 },
      ],
    },
    {
      name: "Sample Recurve Bow (Crit)",
      baseType: "Recurve Bow",
      price: 12,
      mods: [
        { rawText: "35% increased Critical Hit Chance", modKey: "CRITICAL_CHANCE", value: 35 },
        { rawText: "20% increased Attack Speed", modKey: "ATTACK_SPEED", value: 20 },
      ],
    },
  ];

  for (const s of samples) {
    const item = await prisma.item.upsert({
      where: { name_baseType_category: { name: s.name, baseType: s.baseType, category: "BOW" } },
      create: { name: s.name, baseType: s.baseType, category: "BOW", rarity: "RARE" },
      update: {},
    });
    const rawHash = `sample-${item.id}`;
    await prisma.itemListing.upsert({
      where: { rawHash },
      create: {
        itemId: item.id,
        league,
        rawHash,
        sellerAccount: "sample_seller",
        priceAmount: s.price,
        priceCurrency: "exalted",
        priceInBase: s.price,
        isOutlier: false,
        listedAt: new Date(),
        mods: { create: s.mods },
      },
      update: { priceAmount: s.price },
    });
    await prisma.itemSnapshot.create({
      data: {
        itemId: item.id,
        league,
        totalListings: 1,
        validListings: 1,
        medianPrice: s.price,
        medianPriceBase: s.price,
      },
    });
  }
  console.log(`[seed] sample bows: ${samples.length}`);
}

async function main() {
  const league = process.env.POE_LEAGUE ?? "Standard";
  await seedModDefinitions();
  await seedCurrencyRates(league);
  await seedSampleBows(league);
  console.log("[seed] done.");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
