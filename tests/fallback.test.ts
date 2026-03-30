import { describe, expect, it } from "vitest";

import { buildRetrievalOnlyAnswer, isRetriableGenerationError } from "../src/rag/fallback.js";

describe("fallback", () => {
  it("builds a retrieval-only response with sources and legal notice", () => {
    const answer = buildRetrievalOnlyAnswer(
      "vida laboral",
      [
        {
          pageContent: "# Informe de tu vida laboral\n- Consulta todas tus situaciones de alta y baja.\n- Puedes obtener un PDF.",
          score: 0.9,
          rerankScore: 1.2,
          metadata: {
            url: "https://example.com/vida-laboral",
            title: "Informe de tu vida laboral",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["vida-laboral"],
            priority: 4,
          },
        },
      ],
      { family: "general", operation: "general", lifecycleStage: "descubrimiento" },
      {
        family: "general",
        operation: "general",
        lifecycleStage: "descubrimiento",
        facts: {},
        missingFacts: [],
        factsConfirmed: {},
        factsPending: [],
        caseSummary: "Caso abierto sin datos suficientes.",
        lastRecommendedAction: "",
        updatedAt: new Date().toISOString(),
      },
      [],
    );

    expect(answer.text).toContain("Resumen del caso");
    expect(answer.text).toContain("Respuesta breve");
    expect(answer.text).toContain("Fuentes oficiales");
    expect(answer.text).toContain("Aviso legal");
    expect(answer.sources[0]?.url).toBe("https://example.com/vida-laboral");
  });

  it("detects quota and rate-limit errors", () => {
    expect(isRetriableGenerationError({ status: 429 })).toBe(true);
    expect(isRetriableGenerationError({ message: "Quota exceeded" })).toBe(true);
    expect(isRetriableGenerationError({ message: "Other error" })).toBe(false);
  });
});
