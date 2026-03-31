import { describe, expect, it } from "vitest";

import { buildClarificationPayload, buildNoContextAnswer, composeAnswerPayload } from "../src/rag/formatter.js";

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
    expect(response.mode).toBe("answer");
    expect(response.sections.immediateSteps).toEqual([]);
    expect(response.decisionStatus).toBe("ready_to_prepare");
    expect(response.recommendedActions).toEqual([]);
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

  it("extracts structured sections from the preferred answer format", () => {
    const response = composeAnswerPayload(
      [
        "Respuesta breve:",
        "Puedes revisarlo por la sede o presentar la solicitud por el canal que corresponda.",
        "",
        "Como presentarlo:",
        "- Revisa tu identificacion",
        "- Comprueba el tipo de tramite",
        "",
        "Que preparar ahora:",
        "- DNI o NIE",
        "",
        "Que puede cambiar:",
        "- No inventes casillas del formulario",
        "",
        "Si luego hay requerimiento o notificacion:",
        "- Revisa Mis expedientes administrativos",
      ].join("\n"),
      [],
    );

    expect(response.sections.immediateSteps).toEqual(["Revisa tu identificacion", "Comprueba el tipo de tramite"]);
    expect(response.sections.documents).toEqual(["DNI o NIE"]);
    expect(response.sections.whatChangesTheOutcome).toEqual(["No inventes casillas del formulario"]);
    expect(response.sections.ifINSSRespondsX).toEqual(["Revisa Mis expedientes administrativos"]);
  });

  it("prioritizes same-benefit sources over unrelated ones in the final answer", () => {
    const response = composeAnswerPayload(
      "Texto base",
      [
        {
          pageContent: "Alta de beneficiarios en asistencia sanitaria.",
          score: 0.8,
          rerankScore: 0.8,
          metadata: {
            url: "https://sede.seg-social.gob.es/asistencia/alta-beneficiarios",
            title: "Asistencia sanitaria. Alta de beneficiarios",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["alta-beneficiarios", "documentacion"],
            priority: 5,
            benefitId: "alta-beneficiarios",
          },
        },
        {
          pageContent: "Informacion general de asistencia sanitaria.",
          score: 0.75,
          rerankScore: 0.75,
          metadata: {
            url: "https://www.seg-social.es/asistencia",
            title: "Asistencia sanitaria",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["asistencia-sanitaria"],
            priority: 4,
            benefitId: "alta-beneficiarios",
          },
        },
        {
          pageContent: "Formulario del certificado provisional sustitutorio.",
          score: 0.79,
          rerankScore: 0.79,
          metadata: {
            url: "https://sede.seg-social.gob.es/tse/cps.pdf",
            title: "Solicitud de Certificado Provisional Sustitutorio",
            sourceType: "pdf",
            chunkIndex: 0,
            tags: ["tse-cps", "formulario"],
            priority: 4,
            benefitId: "tse-cps",
          },
        },
      ],
      {
        intent: {
          family: "asistencia-sanitaria",
          operation: "documentacion",
          benefitId: "alta-beneficiarios",
          lifecycleStage: "presentacion",
        },
      },
    );

    expect(response.sources.map((source) => source.title)).toEqual([
      "Asistencia sanitaria. Alta de beneficiarios",
      "Asistencia sanitaria",
    ]);
    expect(response.sources[0]?.url).toContain("alta-beneficiarios");
    expect(response.sources[1]?.url).toContain("seg-social.es/asistencia");
  });

  it("keeps legacy fields and adds decision metadata for clarification payloads", () => {
    const response = buildClarificationPayload({
      intent: {
        family: "jubilacion",
        operation: "requisitos",
        benefitId: "jubilacion",
        lifecycleStage: "orientacion",
      },
      state: {
        family: "jubilacion",
        operation: "requisitos",
        benefitId: "jubilacion",
        lifecycleStage: "orientacion",
        facts: {},
        missingFacts: ["modalidad de jubilacion"],
        factsConfirmed: {},
        factsPending: ["modalidad de jubilacion"],
        caseSummary: "Caso abierto sobre Jubilacion.",
        lastRecommendedAction: "",
        updatedAt: new Date().toISOString(),
      },
      clarifyingQuestions: ["Es una jubilacion ordinaria, anticipada, parcial, demorada o SOVI?"],
      recommendedActions: [{ id: "clarify:modalidad:0", label: "Anticipada", prompt: "Mi caso es Anticipada." }],
    });

    expect(response.text).toContain("Respuesta breve");
    expect(response.decisionStatus).toBe("need_info");
    expect(response.recommendedActions[0]?.label).toBe("Anticipada");
    expect(response.text).toContain("Aviso legal");
    expect(response.summary.length).toBeGreaterThan(0);
  });
});
