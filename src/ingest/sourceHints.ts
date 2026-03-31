import { dedupeBy, normalizeSearchText, normalizeWhitespace } from "../utils/text.js";

const TAG_HINTS: Record<string, string[]> = {
  "vida-laboral": [
    "informe de vida laboral",
    "altas y bajas",
    "periodos cotizados",
    "cotizaciones acumuladas",
  ],
  nuss: [
    "numero de la seguridad social",
    "naf",
    "numero de afiliacion",
    "afiliacion seguridad social",
  ],
  autonomo: [
    "alta de autonomo",
    "baja de autonomo",
    "reta",
    "trabajo por cuenta propia",
    "actividad economica",
  ],
  "empleo-hogar": [
    "empleada de hogar",
    "empleado de hogar",
    "alta en empleo de hogar",
    "baja en empleo de hogar",
    "cotizacion hogar",
  ],
  jubilacion: [
    "pension de jubilacion",
    "edad de jubilacion",
    "jubilarme",
    "solicitud de jubilacion",
  ],
  "familia-cuidados": [
    "nacimiento y cuidado de menor",
    "adopcion y acogimiento",
    "cuidado de menor con enfermedad grave",
    "tramites familiares inss",
  ],
  supervivencia: [
    "viudedad",
    "orfandad",
    "favor de familiares",
    "prestaciones por fallecimiento",
  ],
  "asistencia-sanitaria": [
    "tarjeta sanitaria europea",
    "certificado provisional sustitutorio",
    "alta de beneficiarios",
    "tramites de asistencia sanitaria",
  ],
  "incapacidad-temporal": [
    "baja medica",
    "prestacion por incapacidad temporal",
    "subsidio por enfermedad",
    "it seguridad social",
  ],
  "incapacidad-permanente": [
    "invalidez",
    "pension por incapacidad permanente",
    "grados de incapacidad",
  ],
  "incapacidad-permanente-total": [
    "ipt",
    "incapacidad para la profesion habitual",
    "pension total",
  ],
  "gran-incapacidad": [
    "ayuda de tercera persona",
    "complemento de gran incapacidad",
    "gran invalidez",
  ],
  "jubilacion-anticipada": [
    "jubilacion antes de la edad ordinaria",
    "jubilacion anticipada voluntaria",
    "jubilacion anticipada involuntaria",
    "coeficientes reductores",
  ],
  "jubilacion-parcial": [
    "jubilacion parcial",
    "contrato de relevo",
    "reducir jornada y cobrar pension",
  ],
  nacimiento: [
    "maternidad",
    "paternidad",
    "permiso por nacimiento",
    "cuidado de menor",
  ],
  "cuidado-menor-grave": [
    "cuidado de menores con cancer",
    "enfermedad grave del menor",
    "reduccion de jornada por cuidado del menor",
  ],
  discapacidad: [
    "jubilacion anticipada por discapacidad",
    "discapacidad igual o superior",
    "acreditacion de discapacidad",
  ],
  viudedad: [
    "pension de viudedad",
    "prestacion por fallecimiento del conyuge",
    "pension del viudo o viuda",
  ],
  orfandad: [
    "pension de orfandad",
    "prestacion por fallecimiento del progenitor",
  ],
  imv: [
    "ingreso minimo vital",
    "renta minima",
    "prestacion imv",
  ],
  "ayuda-infancia": [
    "complemento de ayuda para la infancia",
    "complemento infancia imv",
    "ayuda por hijos en el imv",
  ],
  "favor-de-familiares": [
    "pension en favor de familiares",
    "subsidio en favor de familiares",
    "prestacion para familiares del fallecido",
  ],
  "auxilio-defuncion": [
    "auxilio por defuncion",
    "ayuda para gastos de sepelio",
    "gastos de entierro",
  ],
  "brecha-genero": [
    "complemento por brecha de genero",
    "complemento por maternidad",
    "complemento por hijos en la pension",
  ],
  tse: [
    "tarjeta sanitaria europea",
    "cps",
    "certificado provisional sustitutorio",
    "asistencia sanitaria en europa",
  ],
  cps: [
    "certificado provisional sustitutorio",
    "cps de la tarjeta sanitaria europea",
    "urgencia antes de viajar",
    "documento provisional para asistencia sanitaria",
  ],
  "cita-previa": [
    "pedir cita en la seguridad social",
    "cita inss",
    "atencion presencial",
  ],
  "sin-certificado": [
    "sin certificado digital",
    "sin clave",
    "sin cl@ve",
    "via sms",
  ],
  beneficiario: [
    "alta de beneficiario",
    "anadir beneficiario",
    "beneficiario de asistencia sanitaria",
  ],
  "cuidado-menor": [
    "prestacion por nacimiento y cuidado de menor",
    "permiso por nacimiento",
    "maternidad y paternidad",
  ],
  "estado-solicitud": [
    "consultar estado de solicitud",
    "seguimiento del expediente",
    "ver en que fase esta",
  ],
  "estado-expediente": [
    "consultar estado del expediente",
    "seguimiento de solicitud inss",
    "mis expedientes administrativos",
    "como va mi prestacion",
  ],
  subsanacion: [
    "subsanar expediente",
    "aportar documentacion adicional",
    "responder a requerimiento del inss",
    "adjuntar documentos pendientes",
  ],
  "subsanacion-requerimiento": [
    "subsanacion de expediente",
    "requerimiento de documentacion inss",
    "aportar papeles pendientes",
    "completar solicitud tras requerimiento",
  ],
  requerimiento: [
    "requerimiento de documentacion",
    "notificacion para aportar papeles",
    "plazo para completar solicitud",
  ],
  notificacion: [
    "notificacion de resolucion",
    "estado de la resolucion",
    "consulta de notificaciones de la seguridad social",
  ],
  caiss: [
    "centro de atencion e informacion de la seguridad social",
    "oficina inss",
    "atencion presencial inss",
    "cita en caiss",
  ],
  "cita-caiss": [
    "cita previa inss",
    "caiss",
    "atencion presencial",
    "oficinas de la seguridad social",
  ],
  "sin-certificado-sms": [
    "tramites sin certificado",
    "via sms",
    "sin cl@ve",
    "sin identificacion electronica",
  ],
  "portal-prestaciones": [
    "portal de prestaciones de la seguridad social",
    "prestaciones seg social",
    "solicitudes y comunicaciones inss",
  ],
  "operativa-inss": [
    "tramites inss",
    "portal de prestaciones",
    "mis expedientes",
    "requerimientos y notificaciones",
  ],
  "certificado-prestaciones": [
    "certificado integral de prestaciones",
    "certificado de ingresos y retenciones",
    "prestaciones percibidas",
  ],
  "convenio-especial": [
    "alta en convenio especial",
    "seguir cotizando voluntariamente",
    "convenio especial seguridad social",
  ],
  "practicas-formativas": [
    "recuperar anos cotizados por practicas",
    "practicas antiguas cotizacion",
    "convenio especial practicas formativas",
  ],
  "periodos-minimos-cotizacion": [
    "periodo minimo de cotizacion",
    "carencia para acceder a prestaciones",
    "dias cotizados necesarios",
  ],
  "riesgo-embarazo": [
    "riesgo durante el embarazo",
    "suspension del contrato por embarazo",
  ],
  lactancia: [
    "riesgo durante la lactancia natural",
    "suspension por lactancia",
  ],
  "incapacidad-permanente-parcial": [
    "incapacidad permanente parcial",
    "lesiones permanentes no incapacitantes",
    "indemnizacion por incapacidad parcial",
  ],
  "incapacidad-permanente-absoluta": [
    "incapacidad permanente absoluta",
    "invalidez absoluta",
    "pension por incapacidad absoluta",
  ],
  mutualista: [
    "jubilacion anticipada por tener la condicion de mutualista",
    "mutualidad laboral",
    "edad real de jubilacion mutualista",
  ],
  mar: [
    "regimen especial de trabajadores del mar",
    "instituto social de la marina",
    "prestaciones de los trabajadores del mar",
  ],
  ism: [
    "instituto social de la marina",
    "sede electronica del ism",
    "servicios del ism",
  ],
  "regimen-especial-del-mar": [
    "regimen especial de trabajadores del mar",
    "trabajadores del mar",
    "instituto social de la marina",
  ],
  documentacion: [
    "papeles necesarios",
    "documentos a presentar",
    "justificantes habituales",
    "que aportar",
    "que adjuntar",
    "que me van a pedir",
  ],
  solicitud: [
    "como se solicita",
    "donde se presenta",
    "tramitar la solicitud",
    "donde presento",
    "como presentarlo",
    "por internet",
    "presencial",
  ],
  cuantia: [
    "cuanto se cobra",
    "importe de la pension",
    "base reguladora",
  ],
  compatibilidades: [
    "se puede trabajar cobrando",
    "que compatibilidades tiene",
    "incompatibilidades",
  ],
  sovi: [
    "seguro obligatorio de vejez e invalidez",
    "pension sovi",
    "compatibilidades sovi",
  ],
  "seguro escolar": [
    "prestaciones del seguro escolar",
    "riesgos cubiertos del seguro escolar",
    "gestion del seguro escolar",
  ],
  violencia: [
    "prestaciones por violencia contra la mujer",
    "tramites especiales inss",
  ],
  terrorismo: [
    "prestaciones por actos terroristas",
    "pensiones extraordinarias por terrorismo",
  ],
  "sindrome toxico": [
    "prestaciones por sindrome toxico",
    "cobertura especial inss",
  ],
  amianto: [
    "prestaciones por amianto",
    "cobertura especial inss",
  ],
  "certificado-digital": [
    "certificado electronico",
    "fnmt",
    "instalacion certificado",
    "renovacion certificado",
    "exportar certificado",
    "sede electronica",
  ],
  autofirma: [
    "autofirma",
    "firma electronica",
    "error de firma",
    "java firma",
    "instalar autofirma",
  ],
  clave: [
    "clave pin",
    "clave permanente",
    "cl@ve",
    "registro clave",
    "identificacion electronica",
    "acceso sede",
  ],
  dnie: [
    "dnie electronico",
    "lector dnie",
    "tarjeta electronica",
    "dni electronico",
  ],
  identificacion: [
    "identificacion electronica",
    "acceso a sede",
    "sistema de identificacion",
    "certificado digital o clave",
  ],
};

const TITLE_HINT_RULES = [
  {
    pattern: /\bsolicitud(?:es)?\b|\btramite\b|\btramitacion\b|\btramitaci[oó]n\b|\bgestion\b|\bgesti[oó]n\b/i,
    hints: [
      "como se solicita",
      "donde se presenta",
      "pasos del tramite",
      "documentacion habitual",
      "donde presento",
      "como presentarlo",
    ],
  },
  {
    pattern: /\bdocumentacion\b|\bdocumentaci[oó]n\b|\bformulario\b/i,
    hints: [
      "que documentos necesito",
      "papeles para presentar",
      "formularios y justificantes",
      "que aportar",
      "que adjuntar",
    ],
  },
  {
    pattern: /\bpresentar\b|\bpresentacion\b|\bpresentaci[oÃ³]n\b|\binternet\b|\bpresencial\b/i,
    hints: [
      "donde presento",
      "como presentarlo",
      "tramite por internet",
      "tramite presencial",
    ],
  },
  {
    pattern: /\brellenar\b|\bcumplimentar\b|\bcasilla\b|\bmodelo\b|\bimpreso\b/i,
    hints: [
      "como rellenar la solicitud",
      "que dato poner en el formulario",
      "como cumplimentar el impreso",
      "modelo oficial y casillas habituales",
    ],
  },
  {
    pattern: /\bsubsan(ar|acion)\b|\brequerimiento\b|\badjuntar\b|\baportar documentacion\b/i,
    hints: [
      "como subsanar un expediente",
      "que hacer ante un requerimiento",
      "donde adjuntar documentacion adicional",
      "que aportar",
      "plazo para responder requerimientos",
    ],
  },
  {
    pattern: /\bnotificacion\b|\bresolucion\b|\bdenegacion\b/i,
    hints: [
      "como revisar una notificacion",
      "como consultar una resolucion",
      "que hacer tras una denegacion",
    ],
  },
  {
    pattern: /\bexpediente\b|\bestado\b|\bseguimiento\b/i,
    hints: [
      "mis expedientes administrativos",
      "seguimiento del expediente",
      "como va mi prestacion",
    ],
  },
  {
    pattern: /\bcita\b|\bcaiss\b|\boficina\b/i,
    hints: [
      "cita previa inss",
      "caiss",
      "atencion presencial seguridad social",
    ],
  },
  {
    pattern: /\bsms\b|\bv[ií]a sms\b|\bsin certificado\b|\bsin certificado digital\b/i,
    hints: [
      "tramite por sms",
      "sin certificado digital",
      "identificacion por sms",
    ],
  },
  {
    pattern: /\brequisitos\b|\bbeneficiarios\b|\bcausantes\b/i,
    hints: [
      "quien puede solicitarlo",
      "que requisitos hay",
      "quien tiene derecho",
    ],
  },
  {
    pattern: /\bcuantia\b|\bcuant[ií]a\b|\bimporte\b|\babono\b/i,
    hints: [
      "cuanto se cobra",
      "importe mensual",
      "como se calcula",
      "base reguladora",
    ],
  },
  {
    pattern: /\bcompatibilidades\b|\bincompatibilidades\b/i,
    hints: [
      "es compatible con trabajar",
      "se puede cobrar y trabajar",
      "incompatibilidades",
    ],
  },
  {
    pattern: /\bplazos\b|\befectos economicos\b|\befectos econ[oó]micos\b/i,
    hints: [
      "cuando surte efecto",
      "desde cuando se cobra",
      "plazos de resolucion",
    ],
  },
];

function dedupeHints(items: string[]): string[] {
  return dedupeBy(
    items
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean),
    (item) => normalizeSearchText(item),
  );
}

export function buildSourceSearchText(input: {
  title: string;
  url: string;
  tags: string[];
  benefitId?: string;
  family?: string;
  lifecycle?: string;
  sourceKind?: string;
  formCodes?: string[];
}): string {
  const hints = new Set<string>();

  for (const tag of input.tags) {
    for (const hint of TAG_HINTS[tag] ?? []) {
      hints.add(hint);
    }
  }

  const combinedText = `${input.title} ${input.url} ${input.tags.join(" ")}`;

  for (const rule of TITLE_HINT_RULES) {
    if (rule.pattern.test(combinedText)) {
      for (const hint of rule.hints) {
        hints.add(hint);
      }
    }
  }

  return dedupeHints([
    input.title,
    ...input.tags,
    ...hints,
    input.benefitId ?? "",
    input.family ?? "",
    input.lifecycle ?? "",
    input.sourceKind ?? "",
    ...(input.formCodes ?? []),
    "inss",
    "seguridad social",
  ]).join(" ");
}
