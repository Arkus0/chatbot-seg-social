import { mkdir, writeFile } from "node:fs/promises";

import { chunkSourceDocument } from "../src/ingest/chunk.js";
import { loadSource } from "../src/ingest/loaders.js";
import { loadSeedSources } from "../src/ingest/sources.js";
import { logger } from "../src/utils/logger.js";

async function main(): Promise<void> {
  const sources = await loadSeedSources();
  const chunks: unknown[] = [];

  for (const source of sources) {
    logger.info("Building fallback corpus entry", { url: source.url });
    const loaded = await loadSource(source);
    const documents = await chunkSourceDocument(loaded);

    chunks.push(
      ...documents.map((document) => ({
        pageContent: document.pageContent,
        metadata: document.metadata,
      })),
    );
  }

  const outputUrl = new URL("../data/cache/fallback-corpus.json", import.meta.url);
  await mkdir(new URL("../data/cache/", import.meta.url), { recursive: true });
  await writeFile(outputUrl, JSON.stringify(chunks, null, 2));

  logger.info("Fallback corpus built", { chunks: chunks.length, output: outputUrl.pathname });
}

main().catch((error) => {
  logger.error("Fallback corpus build failed", error);
  process.exitCode = 1;
});
