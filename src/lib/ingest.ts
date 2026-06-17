import { prisma } from "@/lib/db";
import { ninjaClientFromEnv, PoeNinjaClient } from "@/lib/poeninja/client";
// Import the iteration constant directly from the leaf module (not via client)
// so CJS interop can't leave it undefined ("NINJA_ITEM_TYPES is not iterable").
import { NINJA_ITEM_TYPES } from "@/lib/poeninja/constants";
import { mapNinjaLine, type NinjaMappedItem } from "@/lib/poeninja/map";

/**
 * poe.ninja ingestion (shared by `npm run ingest` and /api/cron/ingest).
 *
 * poe.ninja is an aggregate source: one row per item with a summarized price
 * and listing count. We upsert the canonical Item (with its poecdn iconUrl),
 * a single synthetic aggregate ItemListing (so the detail page isn't empty),
 * an ItemSnapshot (price + supply), and append a PriceHistory point so a real
 * time series builds up across runs.
 */

export interface IngestSummary {
  league: string;
  itemsUpserted: number;
  byType: Record<string, number>;
  errors: Array<{ type: string; message: string }>;
  /**
   * Field names of the first raw line we saw, plus that line itself. The PoE2
   * response shape is undocumented, so this lets us confirm the real icon/price
   * field names from a single ingest run instead of guessing.
   */
  sampleKeys?: string[];
  sampleLine?: unknown;
}

async function persistItem(m: NinjaMappedItem, league: string): Promise<void> {
  const item = await prisma.item.upsert({
    where: {
      name_baseType_category: { name: m.name, baseType: m.baseType, category: m.category },
    },
    create: {
      name: m.name,
      baseType: m.baseType,
      category: m.category,
      rarity: "UNIQUE",
      iconUrl: m.iconUrl,
    },
    update: { iconUrl: m.iconUrl ?? undefined },
  });

  await prisma.itemListing.upsert({
    where: { rawHash: m.rawHash },
    create: {
      itemId: item.id,
      league,
      rawHash: m.rawHash,
      sellerAccount: null,
      priceAmount: m.priceAmount,
      priceCurrency: m.priceCurrency,
      priceInBase: m.priceAmount,
      isOutlier: false,
      listedAt: new Date(),
    },
    update: {
      priceAmount: m.priceAmount,
      priceCurrency: m.priceCurrency,
      priceInBase: m.priceAmount,
      listedAt: new Date(),
    },
  });

  await prisma.itemSnapshot.create({
    data: {
      itemId: item.id,
      league,
      totalListings: m.count,
      validListings: m.count,
      medianPrice: m.priceAmount,
      medianPriceBase: m.priceAmount,
    },
  });

  if (m.priceAmount != null) {
    await prisma.priceHistory.create({
      data: { itemId: item.id, league, value: m.priceAmount },
    });
  }
}

export async function runIngest(client?: PoeNinjaClient): Promise<IngestSummary> {
  const league = process.env.POE_LEAGUE ?? "Standard";
  const ninja = client ?? ninjaClientFromEnv();

  // Allow overriding the category list without a code change, e.g.
  // POENINJA_ITEM_TYPES="UniqueWeapon,UniqueArmour,UniqueAccessory".
  const types =
    process.env.POENINJA_ITEM_TYPES?.split(",").map((s) => s.trim()).filter(Boolean) ??
    [...NINJA_ITEM_TYPES];

  const summary: IngestSummary = { league, itemsUpserted: 0, byType: {}, errors: [] };

  for (const type of types) {
    try {
      const overview = await ninja.getItemOverview(type);
      const lines = overview.lines ?? [];
      // Capture the first raw line once, to confirm the real field names.
      if (!summary.sampleLine && lines.length > 0) {
        summary.sampleLine = lines[0];
        summary.sampleKeys = Object.keys(lines[0] as Record<string, unknown>);
      }
      let n = 0;
      for (const line of lines) {
        const mapped = mapNinjaLine(line, type, league);
        if (!mapped) continue;
        await persistItem(mapped, league);
        n++;
      }
      summary.byType[type] = n;
      summary.itemsUpserted += n;
    } catch (err) {
      // Keep going: one item-type endpoint failing (e.g. unconfirmed path)
      // shouldn't abort the whole ingest.
      summary.errors.push({
        type,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
