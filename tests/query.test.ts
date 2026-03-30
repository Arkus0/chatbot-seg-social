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
    expect(expandQuestion("Quiero jubilarme antes")).toContain("coeficientes reductores");
    expect(expandQuestion("Estoy valorando una jubilacion demorada")).toContain("incentivos");
    expect(expandQuestion("Como rellenar la solicitud de viudedad")).toContain("cumplimentar");
    expect(expandQuestion("Quiero saber el complemento por brecha de genero")).toContain("reduccion de la brecha de genero");
    expect(expandQuestion("Necesito el certificado provisional sustitutorio de la TSE")).toContain(
      "certificado provisional sustitutorio",
    );
    expect(expandQuestion("Como dar de alta a un beneficiario de asistencia sanitaria")).toContain(
      "alta de beneficiarios",
    );
    expect(expandQuestion("Soy mutualista y quiero jubilarme antes")).toContain("edad real 60 anos");
    expect(expandQuestion("Soy trabajador del mar y quiero hacer el tramite")).toContain(
      "instituto social de la marina",
    );
    expect(expandQuestion("Como dar de alta a una empleada de hogar")).toContain("empleo de hogar");
    expect(expandQuestion("Como consultar el estado de mi solicitud por SMS")).toContain("seguimiento expediente");
    expect(expandQuestion("Quiero el certificado integral de prestaciones")).toContain("certificado integral de prestaciones");
    expect(expandQuestion("Que documentacion necesito para viudedad")).toContain("documentacion");
    expect(expandQuestion("Cuanto cobro por gran incapacidad")).toContain("complemento tercera persona");
    expect(expandQuestion("Tengo un requerimiento y debo subsanar el expediente")).toContain("subsanacion");
    expect(expandQuestion("Me llego una notificacion de resolucion")).toContain("resolucion");
    expect(expandQuestion("Necesito cita en un CAISS")).toContain("centro de atencion e informacion");
    expect(expandQuestion("Donde encuentro el modelo oficial")).toContain("impreso oficial");
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
            searchText: "informe de vida laboral altas y bajas periodos cotizados",
          },
        },
      ],
      2,
    );

    expect(ranked[0]?.metadata.title).toBe("Informe de tu vida laboral");
  });

  it("uses source search text to break close lexical ties", () => {
    const ranked = rerankRetrievedChunks(
      "Cuanto cobro por jubilacion demorada",
      [
        {
          pageContent: "Informacion general sobre jubilacion.",
          score: 0.88,
          metadata: {
            url: "https://example.com/general-jubilacion",
            title: "Jubilacion - informacion general",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["jubilacion"],
            priority: 3,
            searchText: "pension de jubilacion edad de jubilacion solicitud de jubilacion",
          },
        },
        {
          pageContent: "La jubilacion demorada puede reconocer incentivos economicos.",
          score: 0.86,
          metadata: {
            url: "https://example.com/jubilacion-demorada",
            title: "Guia para conocer los beneficios de demorar tu jubilacion",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["jubilacion"],
            priority: 4,
            searchText: "jubilacion demorada incentivos cuanto se cobra complemento demora",
          },
        },
      ],
      2,
    );

    expect(ranked[0]?.metadata.url).toBe("https://example.com/jubilacion-demorada");
  });

  it("limits dominance of the same source in the final top results", () => {
    const ranked = rerankRetrievedChunks(
      "Como consultar el estado de una solicitud por sms",
      [
        {
          pageContent: "Consulta por sms el estado de tu solicitud.",
          score: 0.91,
          metadata: {
            url: "https://example.com/sms",
            title: "Consulta estado solicitud por SMS",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["estado-solicitud", "sms"],
            priority: 5,
            searchText: "consultar estado de solicitud por sms seguimiento expediente",
          },
        },
        {
          pageContent: "Consulta por sms el estado de tu solicitud con identificacion previa.",
          score: 0.9,
          metadata: {
            url: "https://example.com/sms",
            title: "Consulta estado solicitud por SMS",
            sourceType: "html",
            chunkIndex: 1,
            tags: ["estado-solicitud", "sms"],
            priority: 5,
            searchText: "consultar estado de solicitud por sms seguimiento expediente",
          },
        },
        {
          pageContent: "Otra parte del mismo articulo sobre el seguimiento por sms.",
          score: 0.89,
          metadata: {
            url: "https://example.com/sms",
            title: "Consulta estado solicitud por SMS",
            sourceType: "html",
            chunkIndex: 2,
            tags: ["estado-solicitud", "sms"],
            priority: 5,
            searchText: "consultar estado de solicitud por sms seguimiento expediente",
          },
        },
        {
          pageContent: "Mis expedientes administrativos te permite revisar solicitudes presentadas.",
          score: 0.9,
          metadata: {
            url: "https://example.com/expedientes",
            title: "Mis expedientes administrativos",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["estado-solicitud"],
            priority: 4,
            searchText: "mis expedientes administrativos consultar estado solicitud",
          },
        },
      ],
      3,
    );

    expect(ranked).toHaveLength(3);
    expect(ranked.filter((chunk) => chunk.metadata.url === "https://example.com/sms")).toHaveLength(2);
    expect(ranked.some((chunk) => chunk.metadata.url === "https://example.com/expedientes")).toBe(true);
  });

  it("prioritizes incapacity form pages for form-filling questions", () => {
    const ranked = rerankRetrievedChunks(
      "Como rellenar la solicitud de incapacidad permanente absoluta",
      [
        {
          pageContent: "Informacion general sobre incapacidad permanente y sus grados.",
          score: 0.89,
          metadata: {
            url: "https://example.com/ip-general",
            title: "Incapacidad permanente - concepto",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["incapacidad-permanente"],
            priority: 3,
            searchText: "incapacidad permanente grados invalidez pension trabajador",
          },
        },
        {
          pageContent: "Descarga el formulario para solicitar incapacidad permanente y lesiones permanentes.",
          score: 0.86,
          metadata: {
            url: "https://example.com/ip-formulario",
            title: "Incapacidad permanente - Lesiones permanentes no incapacitantes",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["incapacidad-permanente", "incapacidad-permanente-absoluta", "solicitud", "formulario"],
            priority: 5,
            searchText:
              "incapacidad permanente absoluta solicitud formulario rellenar documentacion inss lesiones permanentes",
          },
        },
      ],
      2,
    );

    expect(ranked[0]?.metadata.url).toBe("https://example.com/ip-formulario");
  });

  it("prioritizes official social security pages over revista pages", () => {
    const ranked = rerankRetrievedChunks(
      "Como pedir la paternidad",
      [
        {
          pageContent: "Articulo divulgativo sobre el permiso por nacimiento.",
          score: 0.9,
          metadata: {
            url: "https://revista.seg-social.es/guia-paternidad",
            title: "Guia de paternidad",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["nacimiento"],
            priority: 4,
          },
        },
        {
          pageContent: "Solicitud y documentacion para nacimiento y cuidado de menor.",
          score: 0.84,
          metadata: {
            url: "https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/familia/201045",
            title: "Nacimiento y cuidado de menor",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["nacimiento", "cuidado-menor", "solicitud"],
            priority: 4,
          },
        },
      ],
      1,
    );

    expect(ranked[0]?.metadata.url).toContain("sede.seg-social.gob.es");
  });

  it("avoids elevating NUSS chunks when the question is specifically about paternity", () => {
    const ranked = rerankRetrievedChunks(
      "Quiero pedir la paternidad",
      [
        {
          pageContent: "Como obtener el numero de la seguridad social.",
          score: 0.92,
          metadata: {
            url: "https://importass.seg-social.es/nuss",
            title: "Solicitar numero de la Seguridad Social",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["nuss", "solicitud"],
            priority: 4,
          },
        },
        {
          pageContent: "Documentacion y pasos para pedir nacimiento y cuidado de menor.",
          score: 0.84,
          metadata: {
            url: "https://sede.seg-social.gob.es/nacimiento-cuidado-menor",
            title: "Prestacion por nacimiento y cuidado de menor",
            sourceType: "html",
            chunkIndex: 0,
            tags: ["nacimiento", "cuidado-menor", "solicitud", "documentacion"],
            priority: 4,
          },
        },
      ],
      1,
    );

    expect(ranked[0]?.metadata.tags).toContain("nacimiento");
  });
});
