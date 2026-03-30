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
    expect(response.mode).toBe("answer");
    expect(response.sections.immediateSteps).toEqual([]);
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
        "Si lo vas a tramitar ahora:",
        "- Revisa tu identificacion",
        "- Comprueba el tipo de tramite",
        "",
        "Documentos o datos que suelen pedir:",
        "- DNI o NIE",
        "",
        "Ojo con esto:",
        "- No inventes casillas del formulario",
      ].join("\n"),
      [],
    );

    expect(response.sections.immediateSteps).toEqual(["Revisa tu identificacion", "Comprueba el tipo de tramite"]);
    expect(response.sections.documents).toEqual(["DNI o NIE"]);
    expect(response.sections.warnings).toEqual(["No inventes casillas del formulario"]);
  });
});
