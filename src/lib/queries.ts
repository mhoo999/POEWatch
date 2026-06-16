import { prisma } from "@/lib/db";
import type {
  HotMarketEntry,
  ItemSearchResult,
  MetaRadarPoint,
} from "@/lib/domain/types";

/**
 * Server-side data access shared by App Router pages and /api routes, so both
 * speak the exact same contract (src/lib/domain/types.ts).
 *
 * Each function is defensive: if the DB is unavailable the UI/API degrade to
 * empty results instead of crashing, which keeps the dashboard shell demoable.
 */

/** GET /api/items/search — items + their latest snapshot metrics (PRD §3.1). */
export async function getItemSearch(query?: string): Promise<ItemSearchResult[]> {
  try {
    const items = await prisma.item.findMany({
      where: query
        ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { baseType: { contains: query, mode: "insensitive" } }] }
        : undefined,
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: {
        snapshots: { orderBy: { collectedAt: "desc" }, take: 1 },
        _count: { select: { listings: true } },
      },
    });

    return items.map((item) => {
      const snap = item.snapshots[0];
      return {
        id: item.id,
        name: item.name,
        baseType: item.baseType,
        category: item.category,
        medianPrice: snap?.medianPrice ?? null,
        validListings: snap?.validListings ?? 0,
        totalListings: item._count.listings,
      };
    });
  } catch {
    return [];
  }
}

export interface ItemDetail {
  id: string;
  name: string;
  baseType: string;
  category: string;
  listings: Array<{
    id: string;
    priceAmount: number | null;
    priceCurrency: string | null;
    sellerAccount: string | null;
    mods: Array<{ rawText: string; modKey: string | null; value: number | null }>;
  }>;
}

/** GET /api/items/[id] — item + recent listings (PRD §3.2). */
export async function getItemDetail(id: string): Promise<ItemDetail | null> {
  try {
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        listings: {
          take: 50,
          orderBy: { collectedAt: "desc" },
          include: { mods: true },
        },
      },
    });
    if (!item) return null;
    return {
      id: item.id,
      name: item.name,
      baseType: item.baseType,
      category: item.category,
      listings: item.listings.map((l) => ({
        id: l.id,
        priceAmount: l.priceAmount,
        priceCurrency: l.priceCurrency,
        sellerAccount: l.sellerAccount,
        mods: l.mods.map((m) => ({ rawText: m.rawText, modKey: m.modKey, value: m.value })),
      })),
    };
  } catch {
    return null;
  }
}

/** GET /api/meta/radar — option-group share over time (PRD §3.4). */
export async function getMetaRadar(): Promise<MetaRadarPoint[]> {
  try {
    const trends = await prisma.metaTrend.findMany({
      orderBy: { ts: "desc" },
      take: 100,
    });
    return trends.map((t) => ({
      group: t.group,
      share: t.share,
      sampleN: t.sampleN,
      ts: t.ts.toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * GET /api/market/hot — TOP movers (PRD §3.5).
 * Placeholder: the momentum/velocity computation lands in the analytics phase.
 * For now we return an empty, well-typed list so the UI contract is stable.
 */
export async function getHotMarket(): Promise<HotMarketEntry[]> {
  return [];
}
