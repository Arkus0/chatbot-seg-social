import { describe, expect, it } from "vitest";

import { expandQuestion, rerankRetrievedChunks } from "../src/rag/query.js";

describe("query helpers", () => {
  it("expands domain-specific questions", () => {
    expect(expandQuestion("Como consultar mi vida laboral")).toContain("informe de tu vida laboral");
    expect(expandQuestion("Quiero pedir el IMV")).toContain("ingreso minimo vital");
    expect(expandQuestion("Necesito mi numero de la seguridad social")).toContain("nuss");
    expect(expandQuestion("Como darme de alta de autonomo")).toContain("reta");
    expect(expandQuestion("Como pedir la TSE")).toContain("tarjeta sanitaria europea");
    expect(expandQuestion("Cuando me puedo jubilar")).toContain("edad");
    expect(expandQuestion("Que documentacion necesito para viudedad")).toContain("documentacion");
    expect(expandQuestion("Cuanto cobro por gran incapacidad")).toContain("complemento tercera persona");
  });

  it("boosts chunks whose title and tags match the question intent", () => {
    const ranked = rerankRetrievedChunks(
      "Como consultar mi vida laboral",
      [
        {
          pageContent: "Prestaciones y pensiones de trabajadores.",
          score: 0.82,
          metadata: {
            url: "https://example.com/general",
            title: "Trabajadores",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["informacion-general"],
            priority: 1,
          },
        },
        {
          pageContent: "Consulta todas tus situaciones de alta y baja.",
          score: 0.8,
          metadata: {
            url: "https://example.com/vida-laboral",
            title: "Informe de tu vida laboral",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["vida-laboral", "informes"],
            priority: 4,
          },
        },
      ],
      2,
    );

    expect(ranked[0]?.metadata.title).toBe("Informe de tu vida laboral");
  });
});
