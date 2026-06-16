/**
 * poe.ninja (EE2 proxy) ingestion entrypoint.
 *   npm run ingest
 *
 * Populates the DB with PoE2 unique items (name, base/variant, price in Divine
 * Orbs) plus currency conversion rates so the dashboard shows real data. Run
 * from an environment with internet access and a reachable DATABASE_URL.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { runIngest } from "@/lib/ingest";
import { PoeNinjaError } from "@/lib/poeninja/client";

async function main() {
  const summary = await runIngest();
  console.log(
    `[ingest] league=${summary.league} slug=${summary.slug} ` +
      `itemsUpserted=${summary.itemsUpserted} ratesUpserted=${summary.ratesUpserted}`,
  );
  for (const [type, n] of Object.entries(summary.byType)) {
    console.log(`[ingest]   ${type}: ${n}`);
  }
  for (const e of summary.errors) {
    console.error(`[ingest] ERROR ${e.type}: ${e.message}`);
  }
  if (summary.itemsUpserted === 0) {
    console.error(
      "[ingest] No items ingested. Check that POE_LEAGUE maps to a live proxy " +
        "slug (league | leaguehc | standard | standardhc), or set " +
        "POENINJA_LEAGUE_SLUG explicitly.",
    );
  }
}

main()
  .catch((err) => {
    if (err instanceof PoeNinjaError) {
      console.error(`[ingest] poe.ninja error (status ${err.status}): ${err.message}`);
      if (err.body) console.error(`[ingest] body: ${err.body}`);
    } else {
      console.error("[ingest] failed:", err);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
