import type {
  TradeFetchResponse,
  TradeFetchResult,
  TradeQueryBody,
  TradeSearchResponse,
} from "./types";

/**
 * Rate-limit-aware client for the POE2 trade API (trade2).
 *
 * Endpoints (undocumented but used by the official trade site):
 *   POST https://www.pathofexile.com/api/trade2/search/{league}
 *   GET  https://www.pathofexile.com/api/trade2/fetch/{ids}?query={id}&realm=poe2
 *
 * Constraints handled here:
 *  - search returns <= 100 hashes; fetch returns <= 10 items per call.
 *  - GGG enforces rate limits via X-Rate-Limit-* / Retry-After headers; we
 *    back off when asked and throttle fetch batches.
 *  - A descriptive User-Agent is required; POESESSID is sent if configured
 *    (some requests are gated behind Cloudflare / an authenticated session).
 */

const BASE = "https://www.pathofexile.com/api/trade2";
const FETCH_BATCH = 10; // max ids per fetch call
const MIN_DELAY_MS = 1200; // polite floor between requests

export class PoeTradeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "PoeTradeError";
  }
}

interface ClientOptions {
  league: string;
  userAgent: string;
  sessionId?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PoeTradeClient {
  private readonly league: string;
  private readonly userAgent: string;
  private readonly sessionId?: string;

  constructor(opts: ClientOptions) {
    this.league = opts.league;
    this.userAgent = opts.userAgent;
    this.sessionId = opts.sessionId;
  }

  /** Build the headers GGG expects. */
  private headers(json: boolean): HeadersInit {
    const h: Record<string, string> = {
      "User-Agent": this.userAgent,
      Accept: "application/json",
    };
    if (json) h["Content-Type"] = "application/json";
    if (this.sessionId) h["Cookie"] = `POESESSID=${this.sessionId}`;
    return h;
  }

  /**
   * Honor rate-limit signals. If the server sends Retry-After (seconds) we
   * sleep that long; otherwise we apply the polite floor.
   */
  private async respectRateLimit(res: Response): Promise<void> {
    const retryAfter = res.headers.get("Retry-After");
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (!Number.isNaN(secs) && secs > 0) {
        await sleep(secs * 1000);
        return;
      }
    }
    await sleep(MIN_DELAY_MS);
  }

  /** POST a search query; returns the query id + up to 100 result hashes. */
  async searchListings(query: TradeQueryBody): Promise<TradeSearchResponse> {
    const url = `${BASE}/search/${encodeURIComponent(this.league)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(query),
    });

    if (res.status === 429) {
      await this.respectRateLimit(res);
      throw new PoeTradeError("Rate limited on search", 429);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PoeTradeError(
        `Trade search failed (${res.status}). Cloudflare/auth may be blocking server-side requests; try setting POESESSID.`,
        res.status,
        body.slice(0, 500),
      );
    }
    return (await res.json()) as TradeSearchResponse;
  }

  /** Fetch full listing details for a set of hashes, batching by 10. */
  async fetchListings(ids: string[], queryId: string): Promise<TradeFetchResult[]> {
    const out: TradeFetchResult[] = [];
    for (let i = 0; i < ids.length; i += FETCH_BATCH) {
      const batch = ids.slice(i, i + FETCH_BATCH);
      const url = `${BASE}/fetch/${batch.join(",")}?query=${encodeURIComponent(queryId)}&realm=poe2`;
      const res = await fetch(url, { headers: this.headers(false) });

      if (res.status === 429) {
        await this.respectRateLimit(res);
        throw new PoeTradeError("Rate limited on fetch", 429);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new PoeTradeError(`Trade fetch failed (${res.status})`, res.status, body.slice(0, 500));
      }

      const data = (await res.json()) as TradeFetchResponse;
      for (const r of data.result) {
        if (r) out.push(r);
      }
      // Throttle between batches to stay under the rate limit.
      if (i + FETCH_BATCH < ids.length) await sleep(MIN_DELAY_MS);
    }
    return out;
  }
}

/** Construct a client from environment variables. */
export function clientFromEnv(): PoeTradeClient {
  const league = process.env.POE_LEAGUE;
  const userAgent = process.env.POE_USER_AGENT;
  if (!league || !userAgent) {
    throw new Error("POE_LEAGUE and POE_USER_AGENT must be set (see .env.example).");
  }
  return new PoeTradeClient({
    league,
    userAgent,
    sessionId: process.env.POESESSID || undefined,
  });
}
