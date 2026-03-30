import { readFile } from "node:fs/promises";

import type { SeedSource } from "../types/documents.js";

export async function loadSeedSources(): Promise<SeedSource[]> {
  const fileUrl = new URL("../../data/seed/sources.json", import.meta.url);
  const contents = await readFile(fileUrl, "utf-8");
  const parsed = JSON.parse(contents) as SeedSource[];

  return parsed.filter((source) => source.enabled !== false);
}
