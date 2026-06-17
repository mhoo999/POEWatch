import type {
  NinjaCurrencyOverviewResponse,
  NinjaItemLine,
  NinjaItemOverviewResponse,
} from "./types";

/**
 * Client for the poe.ninja PoE2 economy API.
 *
 * Single overview endpoint for every category (confirmed via network capture):
 *   GET {base}/poe2/api/economy/exchange/current/overview?league={League}&type={Type}
 *   e.g. ...?league=Runes of Aldur&type=Currency
 * The `type` selects the category (Currency, plus the unique-item categories
 * such as UniqueWeapon/UniqueArmour — see constants.ts / POENINJA_ITEM_TYPES).
 * Override the whole URL via POENINJA_ITEM_URL only if poe.ninja changes it.
 *
 * poe.ninja rate limit is roughly 12 requests / 5 minutes, so we apply a
 * polite delay between calls. A descriptive User-Agent is sent.
 */

const MIN_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pull the array of item rows out of an overview response. poe.ninja's PoE2
 * shape is undocumented, so tolerate several containers: a bare array, the
 * PoE1 `{ lines: [...] }`, or any single array-valued top-level property
 * (e.g. `items`, `entries`).
 */
export function extractLines(raw: unknown): NinjaItemLine[] {
  if (Array.isArray(raw)) return raw as NinjaItemLine[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.lines)) return obj.lines as NinjaItemLine[];
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v as NinjaItemLine[];
    }
  }
  return [];
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
  /** Override the item-overview path (combined with ?league=&type=). */
  itemOverviewPath?: string;
  /**
   * Full item-overview URL template with `{league}` / `{type}` placeholders,
   * e.g. captured from the browser network tab. Takes precedence over
   * itemOverviewPath, so the real PoE2 endpoint can be configured via env
   * without code changes. Example:
   *   https://poe.ninja/poe2/api/economy/exchange/current/overview?league={league}&type={type}
   */
  itemOverviewUrl?: string;
}

/** PoE2 item-overview categories — re-exported from the leaf constants module. */
export { NINJA_ITEM_TYPES } from "./constants";
export type { NinjaItemType } from "./constants";

export class PoeNinjaClient {
  private readonly league: string;
  private readonly base: string;
  private readonly userAgent: string;
  private readonly itemOverviewPath: string;
  private readonly itemOverviewUrl?: string;
  private lastRequestAt = 0;

  constructor(opts: PoeNinjaClientOptions) {
    this.league = opts.league;
    this.base = (opts.base ?? "https://poe.ninja").replace(/\/$/, "");
    this.userAgent =
      opts.userAgent ?? "poewatch/0.1 (+https://github.com/mhoo999/poewatch)";
    // Confirmed PoE2 endpoint (network capture). Same path for every category.
    this.itemOverviewPath =
      opts.itemOverviewPath ?? "/poe2/api/economy/exchange/current/overview";
    this.itemOverviewUrl = opts.itemOverviewUrl;
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

  /** Build the item-overview URL, preferring an explicit template if given. */
  private itemUrl(type: string): string {
    if (this.itemOverviewUrl) {
      return this.itemOverviewUrl
        .replace(/\{league\}/g, encodeURIComponent(this.league))
        .replace(/\{type\}/g, encodeURIComponent(type));
    }
    return (
      `${this.base}${this.itemOverviewPath}` +
      `?league=${encodeURIComponent(this.league)}&type=${encodeURIComponent(type)}`
    );
  }

  /** Fetch an item overview (e.g. "UniqueWeapon"). */
  async getItemOverview(type: string): Promise<NinjaItemOverviewResponse> {
    const raw = await this.getJson<unknown>(this.itemUrl(type));
    return { lines: extractLines(raw) };
  }

  /** Fetch the currency overview (same endpoint, type=Currency). */
  async getCurrencyOverview(): Promise<NinjaCurrencyOverviewResponse> {
    return this.getJson<NinjaCurrencyOverviewResponse>(this.itemUrl("Currency"));
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
    itemOverviewUrl: process.env.POENINJA_ITEM_URL || undefined,
  });
}
