/**
 * poe.ninja ingestion entrypoint.
 *   npm run ingest
 *
 * Populates the DB with PoE2 unique items (name, poecdn icon, price, supply)
 * so the dashboard shows real data. Run from an environment with internet
 * access to poe.ninja and a reachable DATABASE_URL.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { runIngest } from "@/lib/ingest";
import { PoeNinjaError } from "@/lib/poeninja/client";

async function main() {
  const summary = await runIngest();
  console.log(`[ingest] league=${summary.league} itemsUpserted=${summary.itemsUpserted}`);
  for (const [type, n] of Object.entries(summary.byType)) {
    console.log(`[ingest]   ${type}: ${n}`);
  }
  for (const e of summary.errors) {
    console.error(`[ingest] ERROR ${e.type}: ${e.message}`);
  }
  if (summary.sampleKeys) {
    console.log(`[ingest] sample line keys: ${summary.sampleKeys.join(", ")}`);
    console.log(
      `[ingest] sample line JSON:\n${JSON.stringify(summary.sampleLine, null, 2).slice(0, 2000)}`,
    );
  }
  if (summary.itemsUpserted === 0) {
    console.error(
      "[ingest] No items ingested. The poe.ninja PoE2 item-overview path may be " +
        "wrong — confirm it via the browser network tab and set POENINJA_ITEM_PATH.",
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
