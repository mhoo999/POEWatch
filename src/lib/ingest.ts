import { prisma } from "@/lib/db";
import {
  ninjaClientFromEnv,
  NINJA_UNIQUE_TYPES,
  PoeNinjaClient,
} from "@/lib/poeninja/client";
import { mapNinjaLine, type NinjaMappedItem } from "@/lib/poeninja/map";
import type { NinjaProxyResponse } from "@/lib/poeninja/types";

/**
 * poe.ninja (EE2 proxy) ingestion — shared by `npm run ingest` and
 * /api/cron/ingest.
 *
 * The proxy is an AGGREGATE source: one row per unique with a summarized price
 * (in Divine Orbs) and NO icon or listing/supply count. Per item we upsert the
 * canonical Item, a single synthetic aggregate ItemListing (so the detail page
 * isn't empty), an ItemSnapshot, and append a PriceHistory point so a real time
 * series builds up across runs. We also persist currency conversion rates from
 * the payload's `core` block. Prices are kept in Divine Orbs (the base unit);
 * supply is recorded as 0 because the proxy does not expose listing counts.
 */

const BASE_CURRENCY = "divine";

export interface IngestSummary {
  league: string;
  slug: string;
  itemsUpserted: number;
  byType: Record<string, number>;
  ratesUpserted: number;
  errors: Array<{ type: string; message: string }>;
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
      priceAmount: m.priceDivine,
      priceCurrency: BASE_CURRENCY,
      priceInBase: m.priceDivine,
      isOutlier: false,
      listedAt: new Date(),
    },
    update: {
      priceAmount: m.priceDivine,
      priceCurrency: BASE_CURRENCY,
      priceInBase: m.priceDivine,
      listedAt: new Date(),
    },
  });

  await prisma.itemSnapshot.create({
    data: {
      itemId: item.id,
      league,
      // The proxy exposes no listing counts, so supply is unknown (0).
      totalListings: 0,
      validListings: 0,
      medianPrice: m.priceDivine,
      medianPriceBase: m.priceDivine,
    },
  });

  if (m.priceDivine != null) {
    await prisma.priceHistory.create({
      data: { itemId: item.id, league, value: m.priceDivine },
    });
  }
}

/** Upsert currency conversion rates (1 divine = rate * <currency>) from `core`. */
async function persistRates(
  core: NinjaProxyResponse["core"],
  league: string,
): Promise<number> {
  const rates = core?.rates ?? {};
  let n = 0;
  for (const [currency, rate] of Object.entries(rates)) {
    if (typeof rate !== "number" || !isFinite(rate)) continue;
    await prisma.currencyRate.upsert({
      where: {
        league_currency_base: { league, currency: BASE_CURRENCY, base: currency },
      },
      create: { league, currency: BASE_CURRENCY, base: currency, rate },
      update: { rate },
    });
    n++;
  }
  return n;
}

export async function runIngest(client?: PoeNinjaClient): Promise<IngestSummary> {
  const league = process.env.POE_LEAGUE ?? "Standard";
  const ninja = client ?? ninjaClientFromEnv();

  const summary: IngestSummary = {
    league,
    slug: "",
    itemsUpserted: 0,
    byType: {},
    ratesUpserted: 0,
    errors: [],
  };

  const overview = await ninja.getOverview();
  summary.slug = ninja.slug;

  try {
    summary.ratesUpserted = await persistRates(overview.core, league);
  } catch (err) {
    summary.errors.push({
      type: "core.rates",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const uniqueTypes = new Set<string>(NINJA_UNIQUE_TYPES);
  for (const block of overview.itemOverviews ?? []) {
    if (!uniqueTypes.has(block.type)) continue;
    try {
      let n = 0;
      for (const line of block.lines ?? []) {
        const mapped = mapNinjaLine(line, block.type, ninja.slug);
        if (!mapped) continue;
        await persistItem(mapped, league);
        n++;
      }
      summary.byType[block.type] = n;
      summary.itemsUpserted += n;
    } catch (err) {
      // One category failing shouldn't abort the whole ingest.
      summary.errors.push({
        type: block.type,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
