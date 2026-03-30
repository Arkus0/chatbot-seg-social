import { describe, expect, it } from "vitest";

import { buildNoContextAnswer, composeTelegramAnswer } from "../src/rag/formatter.js";

describe("formatter", () => {
  it("returns a legal notice when there is no context", () => {
    expect(buildNoContextAnswer()).toContain("Aviso legal");
  });

  it("appends sources and legal notice to the answer", () => {
    const response = composeTelegramAnswer("Texto base", [
      {
        pageContent: "contenido",
        score: 0.9,
        metadata: {
          url: "https://example.com",
          title: "Fuente oficial",
          sourceType: "html",
          chunkIndex: 0,
          tags: [],
        },
      },
    ]);

    expect(response).toContain("Fuentes oficiales");
    expect(response).toContain("Aviso legal");
  });
});
