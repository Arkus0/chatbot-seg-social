import { describe, expect, it } from "vitest";

import { analyzeConversation, isTelegramStateExpired } from "../src/rag/conversation.js";

describe("conversation analysis", () => {
  it("asks for missing slots when the case is specific and the answer would change materially", () => {
    const analysis = analyzeConversation("Tengo 63 anos y quiero jubilarme. Que me corresponde?");

    expect(analysis.intent.family).toBe("jubilacion");
    expect(analysis.intent.operation).toBe("requisitos");
    expect(analysis.intent.benefitId).toBe("jubilacion");
    expect(analysis.shouldClarify).toBe(true);
    expect(analysis.state.facts.edad).toBe("63 anos");
    expect(analysis.state.missingFacts).toContain("modalidad de jubilacion");
    expect(analysis.clarifyingQuestions.length).toBeGreaterThan(0);
  });

  it("answers directly for a generic documentation request with enough intent", () => {
    const analysis = analyzeConversation("Que documentos suelen pedir para una incapacidad permanente total?");

    expect(analysis.intent.family).toBe("incapacidad");
    expect(analysis.intent.operation).toBe("documentacion");
    expect(analysis.intent.benefitId).toBe("incapacidad-permanente");
    expect(analysis.state.facts.tipoIncapacidad).toBe("permanente");
    expect(analysis.shouldClarify).toBe(false);
  });

  it("keeps the benefit context on short operational follow-ups", () => {
    const analysis = analyzeConversation("Y si me llega un requerimiento, como lo respondo?", {
      family: "imv",
      operation: "solicitud",
      benefitId: "imv",
      lifecycleStage: "presentacion",
      facts: {
        fase: "primera solicitud",
      },
      missingFacts: [],
      factsConfirmed: {
        fase: "primera solicitud",
      },
      factsPending: [],
      caseSummary: "Caso abierto sobre Ingreso Minimo Vital.",
      lastRecommendedAction: "",
      updatedAt: new Date().toISOString(),
    });

    expect(analysis.intent.family).toBe("imv");
    expect(analysis.intent.operation).toBe("subsanacion-requerimiento");
    expect(analysis.intent.benefitId).toBe("imv");
    expect(analysis.shouldClarify).toBe(false);
    expect(analysis.state.facts.fase).toBe("seguimiento del expediente");
    expect(analysis.state.facts.situacionExpediente).toBe("con requerimiento");
  });

  it("expires telegram state after the ttl", () => {
    expect(
      isTelegramStateExpired({
        family: "operativa-inss",
        operation: "estado-expediente",
        benefitId: "operativa-inss",
        lifecycleStage: "seguimiento",
        facts: {},
        missingFacts: [],
        factsConfirmed: {},
        factsPending: [],
        caseSummary: "Caso abierto sobre Operativa comun del INSS.",
        lastRecommendedAction: "",
        updatedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      }),
    ).toBe(true);
  });
});
