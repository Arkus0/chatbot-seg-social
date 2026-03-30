const FALLBACK_PROCEDURE_LIBRARY = [
  {
    id: "jubilacion",
    label: "Jubilacion",
    shortLabel: "Jubilacion",
    goal: "gestor guiado",
    summary: "Modalidades, documentos, solicitud, seguimiento y siguientes pasos.",
    exampleQuestion: "Tengo 63 anos y quiero jubilarme. Que datos cambian la orientacion y como deberia tramitarlo?",
    promptSeeds: [
      "Quiero revisar requisitos y modalidad de mi jubilacion",
      "Que documentos suelen pedir para jubilacion",
      "Como se presenta y se sigue una solicitud de jubilacion",
    ],
    defaultSituation: "Quiero ordenar modalidad, edad, cotizacion, documentos y siguiente paso antes de presentar.",
  },
  {
    id: "incapacidad-permanente",
    label: "Incapacidad permanente",
    shortLabel: "IP",
    goal: "gestor guiado",
    summary: "Grados, cuantia, compatibilidades, revision y seguimiento del expediente.",
    exampleQuestion:
      "Que cambia entre los grados de incapacidad permanente y como deberia orientar, seguir o reclamar un expediente?",
    promptSeeds: [
      "Quiero revisar grado y requisitos de incapacidad permanente",
      "Que documentos suelen pedir para incapacidad permanente",
      "Como se sigue, se revisa o se reclama una incapacidad permanente",
    ],
    defaultSituation: "Quiero ordenar grado, origen, documentos, cuantia y seguimiento del expediente.",
  },
  {
    id: "imv",
    label: "Ingreso Minimo Vital",
    shortLabel: "IMV",
    goal: "gestor guiado",
    summary: "Solicitud, variaciones, seguimiento, requerimientos, suspension, pago y revision del IMV.",
    exampleQuestion: "Quiero pedir o revisar el IMV. Que datos cambian la respuesta y como debo tramitarlo o seguirlo?",
    promptSeeds: [
      "Quiero revisar requisitos y documentos del IMV",
      "Como se presenta o se sigue una solicitud de IMV",
      "Que hago si hay requerimiento, suspension o reclamacion previa del IMV",
    ],
    defaultSituation:
      "Quiero distinguir si es primera solicitud, cambio de circunstancias, pago, suspension o seguimiento del IMV.",
  },
  {
    id: "operativa-inss",
    label: "Operativa comun del INSS",
    shortLabel: "Operativa",
    goal: "gestor guiado",
    summary: "Portal de Prestaciones, Mis Expedientes, CAISS, notificaciones, requerimientos y vias con SMS.",
    exampleQuestion:
      "Tengo un expediente del INSS y quiero saber como seguirlo, responder a un requerimiento o revisar una notificacion.",
    promptSeeds: [
      "Como seguir un expediente del INSS",
      "Como responder a un requerimiento o revisar una notificacion",
      "Que vias hay con certificado, Cl@ve, SMS o cita previa",
    ],
    defaultSituation: "Quiero ordenar identificacion, expediente y siguiente paso comun del INSS sin perder el contexto.",
  },
];

export async function loadCatalogData() {
  try {
    const response = await fetch("/api/catalog");
    const payload = await response.json();

    if (!response.ok || !payload.ok || !Array.isArray(payload.procedureLibrary)) {
      throw new Error("Catalog unavailable");
    }

    return {
      procedureLibrary: payload.procedureLibrary,
      demoQuestion: typeof payload.demoQuestion === "string" ? payload.demoQuestion : FALLBACK_PROCEDURE_LIBRARY[0].exampleQuestion,
    };
  } catch {
    return {
      procedureLibrary: FALLBACK_PROCEDURE_LIBRARY,
      demoQuestion: FALLBACK_PROCEDURE_LIBRARY.at(-1)?.exampleQuestion ?? "Tengo un requerimiento del INSS y quiero saber que paso me toca ahora.",
    };
  }
}
