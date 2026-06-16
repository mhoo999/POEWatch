import type { NinjaProxyResponse } from "./types";

/**
 * Client for the Exiled Exchange 2 (EE2) poe.ninja PoE2 proxy.
 *
 *   GET https://api.exiledexchange2.dev/proxy/{slug}/overviewData.json
 *
 * Why the proxy instead of poe.ninja directly:
 *   - poe.ninja's PoE2 economy API (`/poe2/api/economy/...`) sits behind
 *     Cloudflare and returns 404/403 to non-browser clients, so server-side
 *     ingestion can't reach it reliably.
 *   - poe.ninja has no PoE2 "dense overview" endpoint, so a direct scrape needs
 *     ~13 throttled requests per run.
 *   - EE2 publishes ONE CDN-cached JSON with every category (currency + all
 *     unique buckets). One request, no auth, no rate-limit headaches.
 *
 * League slugs (case-insensitive display name → proxy slug):
 *   current softcore  → "league"     | current hardcore → "leaguehc"
 *   Standard          → "standard"   | Hardcore Std     → "standardhc"
 * Override explicitly with POENINJA_LEAGUE_SLUG when the heuristic is wrong.
 *
 * Confirmed against live data 2026-06: top keys { core, itemOverviews };
 * unique line keys { name, variant, primaryValue, detailsId, sparkline };
 * core { rates: { exalted, chaos }, primary: "divine" }.
 */

const PROXY_BASE = "https://api.exiledexchange2.dev/proxy";

export type NinjaLeagueSlug = "league" | "leaguehc" | "standard" | "standardhc";

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

/** Unique categories we ingest, keyed by the proxy's (plural) `type` label. */
export const NINJA_UNIQUE_TYPES = [
  "UniqueWeapons",
  "UniqueArmours",
  "UniqueAccessories",
  "UniqueFlasks",
  "UniqueCharms",
  "UniqueJewels",
  "UniqueTablets",
  "UniqueSanctumRelics",
] as const;

export type NinjaUniqueType = (typeof NINJA_UNIQUE_TYPES)[number];

/** Best-effort map of a league display name to the proxy slug. */
export function leagueToSlug(league: string): NinjaLeagueSlug {
  const l = league.trim().toLowerCase();
  const hardcore = /\b(hc|hardcore)\b/.test(l);
  const standard = l.includes("standard");
  if (standard) return hardcore ? "standardhc" : "standard";
  return hardcore ? "leaguehc" : "league";
}

export interface PoeNinjaClientOptions {
  /** Proxy league slug. Takes precedence over `league`-derived slug. */
  slug: NinjaLeagueSlug;
  base?: string;
  userAgent?: string;
}

export class PoeNinjaClient {
  readonly slug: NinjaLeagueSlug;
  private readonly base: string;
  private readonly userAgent: string;

  constructor(opts: PoeNinjaClientOptions) {
    this.slug = opts.slug;
    this.base = (opts.base ?? PROXY_BASE).replace(/\/$/, "");
    this.userAgent =
      opts.userAgent ?? "poewatch/0.1 (+https://github.com/mhoo999/poewatch)";
  }

  /** Fetch the full economy snapshot (currency + all unique categories). */
  async getOverview(): Promise<NinjaProxyResponse> {
    const url = `${this.base}/${this.slug}/overviewData.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PoeNinjaError(
        `EE2 proxy request failed (${res.status}) for ${url}`,
        res.status,
        body.slice(0, 300),
      );
    }
    return (await res.json()) as NinjaProxyResponse;
  }
}

/** Construct a client from environment variables. */
export function ninjaClientFromEnv(): PoeNinjaClient {
  const explicit = process.env.POENINJA_LEAGUE_SLUG?.trim().toLowerCase();
  const league = process.env.POE_LEAGUE;
  if (!explicit && !league) {
    throw new Error(
      "Set POE_LEAGUE (or POENINJA_LEAGUE_SLUG) so the proxy slug can be resolved (see .env.example).",
    );
  }
  const slug = (explicit as NinjaLeagueSlug) || leagueToSlug(league!);
  return new PoeNinjaClient({
    slug,
    base: process.env.POENINJA_BASE || undefined,
    userAgent: process.env.POE_USER_AGENT || undefined,
  });
}
