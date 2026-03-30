import { describe, expect, it } from "vitest";

import { buildNoContextAnswer, composeAnswerPayload } from "../src/rag/formatter.js";

describe("formatter", () => {
  it("returns a legal notice when there is no context", () => {
    expect(buildNoContextAnswer()).toContain("Aviso legal");
  });

  it("appends sources and legal notice to the answer", () => {
    const response = composeAnswerPayload("Texto base", [
      {
        pageContent: "contenido",
        score: 0.9,
        metadata: {
          url: "https://example.com",
          title: "Fuente oficial",
          sourceType: "html",
          chunkIndex: 0,
          tags: [],
          priority: 1,
        },
      },
    ]);

    expect(response.text).toContain("Fuentes oficiales");
    expect(response.text).toContain("Aviso legal");
    expect(response.sources[0]?.url).toBe("https://example.com");
  });

  it("ignores section headings when extracting the summary", () => {
    const response = composeAnswerPayload(
      [
        "Respuesta breve:",
        "Puedes solicitarlo por internet o de forma presencial si el contexto recuperado lo permite.",
        "",
        "Si lo vas a tramitar ahora:",
        "- Revisa la documentacion",
      ].join("\n"),
      [],
    );

    expect(response.summary).toBe(
      "Puedes solicitarlo por internet o de forma presencial si el contexto recuperado lo permite.",
    );
  });
});
