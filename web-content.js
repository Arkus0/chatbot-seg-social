export const PROCEDURE_LIBRARY = [
  {
    id: "jubilacion",
    label: "Jubilacion",
    shortLabel: "Jubilacion",
    goal: "documentacion y pasos",
    summary: "Requisitos, solicitud, documentos y vias de presentacion.",
    exampleQuestion: "Que documentacion necesito para solicitar la jubilacion y por donde la presento?",
    promptSeeds: [
      "Que documentacion necesito para solicitar la jubilacion?",
      "Como preparo la solicitud de jubilacion anticipada?",
    ],
    defaultSituation: "Quiero ordenar requisitos, documentacion y pasos antes de presentar la solicitud.",
  },
  {
    id: "autonomo",
    label: "Alta o baja de autonomo",
    shortLabel: "Autonomos",
    goal: "solicitud y presentacion",
    summary: "Alta, baja, datos previos y orden practico del tramite.",
    exampleQuestion: "Como darme de alta como autonomo y que datos me van a pedir?",
    promptSeeds: [
      "Como darme de alta como autonomo?",
      "Que necesito para tramitar la baja de autonomo?",
    ],
    defaultSituation: "Voy a iniciar o cerrar actividad y quiero una lista clara de pasos y datos necesarios.",
  },
  {
    id: "viudedad",
    label: "Pension de viudedad",
    shortLabel: "Viudedad",
    goal: "documentacion y pasos",
    summary: "Beneficiarios, cuantia, solicitud y papeles habituales.",
    exampleQuestion: "Que documentos necesito para solicitar la pension de viudedad?",
    promptSeeds: [
      "Que documentos necesito para solicitar la pension de viudedad?",
      "Quien puede ser beneficiario de la pension de viudedad?",
    ],
    defaultSituation: "Quiero saber que papeles me pueden pedir y como ordenar la solicitud.",
  },
  {
    id: "incapacidad-total",
    label: "Incapacidad permanente total",
    shortLabel: "Incapacidad total",
    goal: "cuantia y compatibilidades",
    summary: "Solicitud, beneficiarios, cuantia, pago y compatibilidades.",
    exampleQuestion: "Que documentacion necesito para solicitar una incapacidad permanente total?",
    promptSeeds: [
      "Que documentacion necesito para solicitar una incapacidad permanente total?",
      "Cuanto se cobra y que compatibilidades tiene la incapacidad permanente total?",
    ],
    defaultSituation: "Necesito ordenar documentacion, cuantia y pasos para preparar la solicitud.",
  },
  {
    id: "gran-incapacidad",
    label: "Gran incapacidad",
    shortLabel: "Gran incapacidad",
    goal: "cuantia y compatibilidades",
    summary: "Complemento, cuantia y cuestiones practicas de gestion.",
    exampleQuestion: "Cuanto cobro por gran incapacidad y que complemento incluye?",
    promptSeeds: [
      "Cuanto cobro por gran incapacidad?",
      "Como se gestiona el complemento de gran incapacidad?",
    ],
    defaultSituation: "Quiero entender cuantia, complemento y posibles pasos de gestion.",
  },
  {
    id: "nacimiento",
    label: "Nacimiento y cuidado de menor",
    shortLabel: "Nacimiento",
    goal: "documentacion y pasos",
    summary: "Solicitud, plazos, documentacion y vias de tramitacion.",
    exampleQuestion: "Que documentacion necesito para solicitar nacimiento y cuidado de menor?",
    promptSeeds: [
      "Que documentacion necesito para solicitar nacimiento y cuidado de menor?",
      "Como preparo la solicitud por nacimiento y cuidado de menor?",
    ],
    defaultSituation: "Quiero revisar plazos, documentos y presentacion de la solicitud.",
  },
  {
    id: "imv",
    label: "Ingreso Minimo Vital",
    shortLabel: "IMV",
    goal: "documentacion y pasos",
    summary: "Solicitud, variaciones y comprobaciones utiles antes de presentar.",
    exampleQuestion: "Que documentos necesito para solicitar el Ingreso Minimo Vital?",
    promptSeeds: [
      "Que documentos necesito para solicitar el Ingreso Minimo Vital?",
      "Como se presenta la solicitud del Ingreso Minimo Vital?",
    ],
    defaultSituation: "Quiero confirmar documentacion y preparar la solicitud con menos errores.",
  },
  {
    id: "tse",
    label: "Tarjeta Sanitaria Europea",
    shortLabel: "TSE",
    goal: "solicitud y presentacion",
    summary: "Solicitud, renovacion y comprobaciones para asistencia sanitaria temporal.",
    exampleQuestion: "Como pedir la Tarjeta Sanitaria Europea y que requisitos revisan?",
    promptSeeds: [
      "Como pedir la Tarjeta Sanitaria Europea?",
      "Que requisitos revisan para la Tarjeta Sanitaria Europea?",
    ],
    defaultSituation: "Necesito ordenar solicitud, requisitos y posibles incidencias antes de viajar.",
  },
];

export const DEMO_QUESTION =
  "Que documentacion necesito para solicitar una incapacidad permanente total y que pasos deberia revisar antes de presentarla?";
