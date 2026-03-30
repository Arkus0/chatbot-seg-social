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
  jubilacion: [
    "pension de jubilacion",
    "edad de jubilacion",
    "jubilarme",
    "solicitud de jubilacion",
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
  "riesgo-embarazo": [
    "riesgo durante el embarazo",
    "suspension del contrato por embarazo",
  ],
  lactancia: [
    "riesgo durante la lactancia natural",
    "suspension por lactancia",
  ],
  documentacion: [
    "papeles necesarios",
    "documentos a presentar",
    "justificantes habituales",
  ],
  solicitud: [
    "como se solicita",
    "donde se presenta",
    "tramitar la solicitud",
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
};

const TITLE_HINT_RULES = [
  {
    pattern: /\bsolicitud(?:es)?\b|\btramite\b|\btramitacion\b|\btramitaci[oó]n\b|\bgestion\b|\bgesti[oó]n\b/i,
    hints: [
      "como se solicita",
      "donde se presenta",
      "pasos del tramite",
      "documentacion habitual",
    ],
  },
  {
    pattern: /\bdocumentacion\b|\bdocumentaci[oó]n\b|\bformulario\b/i,
    hints: [
      "que documentos necesito",
      "papeles para presentar",
      "formularios y justificantes",
    ],
  },
  {
    pattern: /\brellenar\b|\bcumplimentar\b|\bcasilla\b|\bmodelo\b|\bimpreso\b/i,
    hints: [
      "como rellenar la solicitud",
      "que dato poner en el formulario",
      "como cumplimentar el impreso",
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

export function buildSourceSearchText(input: { title: string; url: string; tags: string[] }): string {
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

  return dedupeHints([input.title, ...input.tags, ...hints]).join(" ");
}
