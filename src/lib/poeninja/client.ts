import type {
  NinjaCurrencyOverviewResponse,
  NinjaItemOverviewResponse,
} from "./types";

/**
 * Client for the poe.ninja PoE2 economy API.
 *
 * Endpoints (undocumented, discovered via network interception):
 *   - Currency (confirmed):
 *       GET {base}/poe2/api/economy/currencyexchange/overview
 *           ?leagueName={league}&overviewName=Currency
 *   - Items (NOT publicly documented — CONFIRM before relying on it):
 *       Inspect poe.ninja/poe2/economy in the browser network tab to capture
 *       the real item-overview request. The path below mirrors the PoE1 shape
 *       ({base}/poe2/api/data/itemoverview?league=&type=UniqueWeapon) and is a
 *       best-effort default; override via overviewPath if it differs.
 *
 * poe.ninja rate limit is roughly 12 requests / 5 minutes, so we apply a
 * polite delay between calls. A descriptive User-Agent is sent.
 */

const MIN_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PoeNinjaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "PoeNinjaError";
  }
}

export interface PoeNinjaClientOptions {
  league: string;
  base?: string;
  userAgent?: string;
  /** Override the item-overview path template if confirmed to differ. */
  itemOverviewPath?: string;
}

/** PoE2 item-overview categories worth ingesting first (uniques). */
export const NINJA_ITEM_TYPES = [
  "UniqueWeapon",
  "UniqueArmour",
  "UniqueAccessory",
  "UniqueFlask",
  "UniqueJewel",
] as const;

export type NinjaItemType = (typeof NINJA_ITEM_TYPES)[number];

export class PoeNinjaClient {
  private readonly league: string;
  private readonly base: string;
  private readonly userAgent: string;
  private readonly itemOverviewPath: string;
  private lastRequestAt = 0;

  constructor(opts: PoeNinjaClientOptions) {
    this.league = opts.league;
    this.base = (opts.base ?? "https://poe.ninja").replace(/\/$/, "");
    this.userAgent =
      opts.userAgent ?? "poewatch/0.1 (+https://github.com/mhoo999/poewatch)";
    // PoE1-style default; confirm against the live PoE2 site.
    this.itemOverviewPath = opts.itemOverviewPath ?? "/poe2/api/data/itemoverview";
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed);
    this.lastRequestAt = Date.now();
  }

  private async getJson<T>(url: string): Promise<T> {
    await this.throttle();
    const res = await fetch(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PoeNinjaError(
        `poe.ninja request failed (${res.status}) for ${url}`,
        res.status,
        body.slice(0, 300),
      );
    }
    return (await res.json()) as T;
  }

  /** Fetch an item overview (e.g. "UniqueWeapon"). */
  async getItemOverview(type: string): Promise<NinjaItemOverviewResponse> {
    const url =
      `${this.base}${this.itemOverviewPath}` +
      `?league=${encodeURIComponent(this.league)}&type=${encodeURIComponent(type)}`;
    return this.getJson<NinjaItemOverviewResponse>(url);
  }

  /** Fetch the currency-exchange overview (confirmed endpoint). */
  async getCurrencyOverview(): Promise<NinjaCurrencyOverviewResponse> {
    const url =
      `${this.base}/poe2/api/economy/currencyexchange/overview` +
      `?leagueName=${encodeURIComponent(this.league)}&overviewName=Currency`;
    return this.getJson<NinjaCurrencyOverviewResponse>(url);
  }
}

/** Construct a client from environment variables. */
export function ninjaClientFromEnv(): PoeNinjaClient {
  const league = process.env.POE_LEAGUE;
  if (!league) {
    throw new Error("POE_LEAGUE must be set (see .env.example).");
  }
  return new PoeNinjaClient({
    league,
    base: process.env.POENINJA_BASE || undefined,
    userAgent: process.env.POE_USER_AGENT || undefined,
    itemOverviewPath: process.env.POENINJA_ITEM_PATH || undefined,
  });
}
