/**
 * POE2 Meta Radar — collector (foundation, single category: bows).
 *
 * Pipeline (PRD Phase 1): search -> fetch -> normalize -> persist.
 *   npm run collect
 *
 * This is intentionally ONE category / ONE query so the scaffold has a real,
 * runnable end-to-end path against the live trade API. If Cloudflare/auth
 * blocks server-side requests, the error is reported clearly so the operator
 * can set POESESSID or fall back to seeded data.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { clientFromEnv, PoeTradeError } from "@/lib/poe/client";
import { bowQuery } from "@/lib/poe/queries";
import { mapFetchResult } from "@/lib/poe/map";
import { median } from "@/lib/analytics/outliers";
import type { NormalizedListing } from "@/lib/domain/types";

// Keep the foundation run small & polite.
const MAX_LISTINGS = 20;

async function persist(listing: NormalizedListing, league: string): Promise<string> {
  // Upsert the canonical item.
  const item = await prisma.item.upsert({
    where: {
      name_baseType_category: {
        name: listing.itemName,
        baseType: listing.baseType,
        category: listing.category,
      },
    },
    create: {
      name: listing.itemName,
      baseType: listing.baseType,
      category: listing.category,
      rarity: listing.rarity,
      iconUrl: listing.iconUrl,
    },
    update: { iconUrl: listing.iconUrl ?? undefined },
  });

  // Idempotent on rawHash: replace mods to reflect latest observation.
  await prisma.itemListing.upsert({
    where: { rawHash: listing.rawHash },
    create: {
      itemId: item.id,
      league,
      rawHash: listing.rawHash,
      sellerAccount: listing.sellerAccount,
      priceAmount: listing.priceAmount,
      priceCurrency: listing.priceCurrency,
      listedAt: listing.listedAt,
      mods: {
        create: listing.mods.map((m) => ({
          rawText: m.rawText,
          modKey: m.modKey,
          value: m.value,
        })),
      },
    },
    update: {
      sellerAccount: listing.sellerAccount,
      priceAmount: listing.priceAmount,
      priceCurrency: listing.priceCurrency,
      listedAt: listing.listedAt,
    },
  });

  return item.id;
}

async function main() {
  const client = clientFromEnv();
  const league = process.env.POE_LEAGUE!;
  console.log(`[collect] league=${league} category=BOW`);

  // 1. Search.
  const search = await client.searchListings(bowQuery());
  console.log(`[collect] search ok: total=${search.total}, hashes=${search.result.length}`);
  const ids = search.result.slice(0, MAX_LISTINGS);
  if (ids.length === 0) {
    console.log("[collect] no results; nothing to do.");
    return;
  }

  // 2. Fetch.
  const results = await client.fetchListings(ids, search.id);
  console.log(`[collect] fetched ${results.length} listings`);

  // 3. Normalize + 4. Persist.
  const itemIdToPrices = new Map<string, number[]>();
  let saved = 0;
  for (const raw of results) {
    const mapped = mapFetchResult(raw, "BOW");
    if (!mapped) continue;
    mapped.league = league;
    const itemId = await persist(mapped, league);
    saved++;
    if (mapped.priceAmount != null) {
      const arr = itemIdToPrices.get(itemId) ?? [];
      arr.push(mapped.priceAmount);
      itemIdToPrices.set(itemId, arr);
    }
  }
  console.log(`[collect] persisted ${saved} listings across ${itemIdToPrices.size} items`);

  // Basic per-item snapshot (median price / counts). Outlier-aware stats land
  // in the analytics phase; this proves the snapshot path works.
  for (const [itemId, prices] of itemIdToPrices) {
    await prisma.itemSnapshot.create({
      data: {
        itemId,
        league,
        totalListings: prices.length,
        validListings: prices.length,
        medianPrice: median(prices),
      },
    });
  }
  console.log(`[collect] wrote ${itemIdToPrices.size} snapshots`);
}

main()
  .catch((err) => {
    if (err instanceof PoeTradeError) {
      console.error(`[collect] POE trade API error (status ${err.status}): ${err.message}`);
      if (err.body) console.error(`[collect] response body: ${err.body}`);
      console.error(
        "[collect] Tip: the trade API sits behind Cloudflare and rate limits. " +
          "Set a valid POESESSID and a descriptive POE_USER_AGENT in .env, and retry.",
      );
    } else {
      console.error("[collect] failed:", err);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
