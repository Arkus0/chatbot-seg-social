import { ingestConfiguredSources } from "../src/ingest/upsert.js";
import { logger } from "../src/utils/logger.js";

async function main(): Promise<void> {
  await ingestConfiguredSources();
  logger.info("Ingestion finished");
}

main().catch((error) => {
  logger.error("Ingestion failed", error);
  process.exitCode = 1;
});
