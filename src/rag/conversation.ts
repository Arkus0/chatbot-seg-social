import type {
  ChatIntent,
  ChatState,
  IntentFamily,
  IntentOperation,
  LifecycleStage,
  RecommendedAction,
} from "../types/answers.js";
import { normalizeSearchText, tokenizeSearchText } from "../utils/text.js";
import { detectBenefitId, getBenefitCatalogEntry } from "./inssCatalog.js";

type SlotDefinition = {
  key: string;
  label: string;
  question: string;
  options: string[];
  shouldAsk: (state: ChatState, question: string) => boolean;
};

type AnalysisRule<T extends string> = {
  value: T;
  patterns: RegExp[];
};

export interface ConversationAnalysis {
  intent: ChatIntent;
  state: ChatState;
  shouldClarify: boolean;
  clarifyingQuestions: string[];
  recommendedActions: RecommendedAction[];
  suggestedReplies: string[];
  retrievalQuestion: string;
}

const GENERAL_INTENT: ChatIntent = {
  family: "general",
  operation: "general",
};

const FAMILY_FALLBACK_RULES: AnalysisRule<IntentFamily>[] = [
  {
    value: "imv",
    patterns: [/\bingreso minimo vital\b/i, /\bimv\b/i],
  },
  {
    value: "asistencia-sanitaria",
    patterns: [/\btse\b/i, /\bcps\b/i, /\basistencia sanitaria\b/i, /\bbeneficiari[oa]s?\b/i],
  },
  {
    value: "supervivencia",
    patterns: [/\bviudedad\b/i, /\borfandad\b/i, /\bfavor de familiares\b/i, /\bdefuncion\b/i],
  },
  {
    value: "familia-cuidados",
    patterns: [
      /\bnacimiento\b/i,
      /\bcuidado de menor\b/i,
      /\bmaternidad\b/i,
      /\bpaternidad\b/i,
      /\badopcion\b/i,
      /\bacogimiento\b/i,
      /\bembarazo\b/i,
      /\blactancia\b/i,
      /\bbrecha de genero\b/i,
    ],
  },
  {
    value: "incapacidad",
    patterns: [/\bincapacidad\b/i, /\binvalidez\b/i, /\bbaja medica\b/i],
  },
  {
    value: "jubilacion",
    patterns: [/\bjubil/i, /\bmutualista\b/i, /\bsovi\b/i],
  },
  {
    value: "prestaciones-especiales",
    patterns: [/\bseguro escolar\b/i, /\bterrorismo\b/i, /\bviolencia contra la mujer\b/i, /\bamianto\b/i],
  },
  {
    value: "operativa-inss",
    patterns: [
      /\binss\b/i,
      /\bcaiss\b/i,
      /\bcita previa\b/i,
      /\bmis expedientes\b/i,
      /\brequerimiento\b/i,
      /\bsubsan/i,
      /\bnotificacion\b/i,
      /\bexpediente\b/i,
      /\bsms\b/i,
      /\bsin certificado\b/i,
    ],
  },
];

const OPERATION_RULES: AnalysisRule<IntentOperation>[] = [
  {
    value: "reclamacion-previa",
    patterns: [/\breclamacion previa\b/i, /\breclamar\b/i, /\bimpugnar\b/i],
  },
  {
    value: "silencio-administrativo",
    patterns: [/\bsilencio administrativo\b/i, /\bno me contestan\b/i, /\bno responden\b/i],
  },
  {
    value: "subsanacion-requerimiento",
    patterns: [/\bsubsan/i, /\brequerimiento\b/i, /\baportar documentacion\b/i, /\badjuntar documentos?\b/i],
  },
  {
    value: "notificacion",
    patterns: [/\bnotificacion(?:es)?\b/i, /\bresolucion\b/i, /\bdenegad/i],
  },
  {
    value: "estado-expediente",
    patterns: [/\bestado\b/i, /\bexpediente\b/i, /\bseguimiento\b/i, /\bcomo va\b/i, /\bmis expedientes\b/i],
  },
  {
    value: "rellenado-formulario",
    patterns: [/\brellen/i, /\bcumpliment/i, /\bcasilla\b/i, /\bmodelo\b/i, /\bformulario\b/i],
  },
  {
    value: "cita-caiss",
    patterns: [/\bcita previa\b/i, /\bcaiss\b/i, /\boficina\b/i, /\batencion presencial\b/i],
  },
  {
    value: "sin-certificado-sms",
    patterns: [/\bsms\b/i, /\bsin certificado\b/i, /\bsin cl@ve\b/i, /\bcertificado digital\b/i],
  },
  {
    value: "compatibilidades",
    patterns: [/\bcompatibilidades?\b/i, /\bincompatibilidades?\b/i, /\btrabajar cobrando\b/i],
  },
  {
    value: "pago-cobro",
    patterns: [/\bpago\b/i, /\bcobro\b/i, /\babono\b/i, /\bnomina\b/i],
  },
  {
    value: "cuantia",
    patterns: [/\bcuantia\b/i, /\bimporte\b/i, /\bcuanto cobro\b/i, /\bbase reguladora\b/i],
  },
  {
    value: "plazos",
    patterns: [/\bplazo\b/i, /\bplazos\b/i, /\bcuanto tarda\b/i, /\bcuando se cobra\b/i, /\befectos economicos\b/i],
  },
  {
    value: "revision",
    patterns: [/\brevision\b/i, /\brevisar\b/i, /\brevocacion\b/i],
  },
  {
    value: "variacion-datos",
    patterns: [/\bvariacion de datos\b/i, /\bcambio de datos\b/i, /\bcambio de circunstancias\b/i, /\bmodificar datos\b/i],
  },
  {
    value: "suspension-extincion",
    patterns: [/\bsuspension\b/i, /\bextincion\b/i, /\bme la quitan\b/i],
  },
  {
    value: "documentacion",
    patterns: [/\bdocumentacion\b/i, /\bdocumentos?\b/i, /\bpapeles\b/i, /\bjustificantes?\b/i],
  },
  {
    value: "requisitos",
    patterns: [/\brequisitos?\b/i, /\bquien puede\b/i, /\btengo derecho\b/i, /\bme corresponde\b/i, /\bpuedo\b/i],
  },
  {
    value: "solicitud",
    patterns: [/\bsolicitar\b/i, /\bsolicitud\b/i, /\btramitar\b/i, /\bpresentar\b/i, /\bcomo se pide\b/i],
  },
];

const OPERATION_STAGE_MAP: Record<IntentOperation, LifecycleStage> = {
  general: "descubrimiento",
  requisitos: "orientacion",
  documentacion: "preparacion",
  solicitud: "presentacion",
  "rellenado-formulario": "preparacion",
  "estado-expediente": "seguimiento",
  "subsanacion-requerimiento": "seguimiento",
  notificacion: "resolucion",
  "cita-caiss": "presentacion",
  "sin-certificado-sms": "presentacion",
  cuantia: "orientacion",
  plazos: "orientacion",
  compatibilidades: "orientacion",
  "pago-cobro": "resolucion",
  revision: "revision",
  "reclamacion-previa": "revision",
  "silencio-administrativo": "revision",
  "variacion-datos": "presentacion",
  "suspension-extincion": "resolucion",
};

const SENSITIVE_OPERATIONS = new Set<IntentOperation>([
  "estado-expediente",
  "subsanacion-requerimiento",
  "notificacion",
  "sin-certificado-sms",
  "reclamacion-previa",
  "revision",
  "suspension-extincion",
  "pago-cobro",
]);

const BLOCKING_SLOT_KEYS_BY_FAMILY: Record<IntentFamily, string[]> = {
  general: ["prestacion"],
  jubilacion: ["modalidad"],
  incapacidad: ["tipoIncapacidad"],
  "familia-cuidados": ["supuesto"],
  supervivencia: ["tipoSupervivencia"],
  "asistencia-sanitaria": ["servicioSanitario"],
  imv: ["fase"],
  "operativa-inss": ["situacionExpediente"],
  "prestaciones-especiales": ["coberturaEspecial"],
};

function createEmptyState(intent: ChatIntent = GENERAL_INTENT): ChatState {
  return {
    family: intent.family,
    operation: intent.operation,
    benefitId: intent.benefitId,
    lifecycleStage: intent.lifecycleStage ?? "descubrimiento",
    facts: {},
    missingFacts: [],
    factsConfirmed: {},
    factsPending: [],
    caseSummary: "Caso abierto sin datos suficientes.",
    lastRecommendedAction: "",
    updatedAt: new Date().toISOString(),
  };
}

function detectByRules<T extends string>(question: string, rules: AnalysisRule<T>[], fallback: T): T {
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(question))) {
      return rule.value;
    }
  }

  return fallback;
}

function detectFamily(question: string): IntentFamily {
  return detectByRules(question, FAMILY_FALLBACK_RULES, "general");
}

function detectOperation(question: string): IntentOperation {
  return detectByRules(question, OPERATION_RULES, "general");
}

function isContextualFollowUp(question: string): boolean {
  const normalized = normalizeSearchText(question);
  const tokens = tokenizeSearchText(question);

  if (tokens.length <= 6) {
    return true;
  }

  return [
    "ver documentos",
    "como presentarlo",
    "como se presenta",
    "seguir expediente",
    "que cambia",
    "si hay requerimiento",
    "si hay notificacion",
    "quiero ver documentos",
  ].some((pattern) => normalized.includes(pattern));
}

function normalizeIncomingState(state?: ChatState): ChatState {
  const base = createEmptyState();

  if (!state) {
    return base;
  }

  return {
    ...base,
    ...state,
    facts: state.facts ?? {},
    missingFacts: state.missingFacts ?? [],
    factsConfirmed: state.factsConfirmed ?? state.facts ?? {},
    factsPending: state.factsPending ?? state.missingFacts ?? [],
    caseSummary: state.caseSummary ?? base.caseSummary,
    lastRecommendedAction: state.lastRecommendedAction ?? "",
    updatedAt: state.updatedAt ?? new Date().toISOString(),
  };
}

function isCaseSpecific(question: string, operation: IntentOperation): boolean {
  if (SENSITIVE_OPERATIONS.has(operation)) {
    return true;
  }

  return (
    /\bmi\b/i.test(question) ||
    /\bme\b/i.test(question) ||
    /\btengo\b/i.test(question) ||
    /\bya\b/i.test(question) ||
    /\ben mi caso\b/i.test(question) ||
    /\bpara mi\b/i.test(question) ||
    /\bcon \d{2}\s*a[nn]os\b/i.test(normalizeSearchText(question)) ||
    /\b\d+\s*a[nn]os cotizados\b/i.test(normalizeSearchText(question))
  );
}

function extractMatchedValue(question: string, rules: Array<{ value: string; pattern: RegExp }>): string | undefined {
  for (const rule of rules) {
    if (rule.pattern.test(question)) {
      return rule.value;
    }
  }

  return undefined;
}

function extractAge(question: string): string | undefined {
  const normalizedQuestion = normalizeSearchText(question);
  const match = normalizedQuestion.match(/\b(\d{2})\s+anos\b/i);
  return match ? `${match[1]} anos` : undefined;
}

function extractContribution(question: string): string | undefined {
  const normalizedQuestion = normalizeSearchText(question);
  const years = normalizedQuestion.match(/\b(\d{1,2})\s+anos(?:\s+y\s+\d{1,2}\s+meses)?\s+cotizados\b/i);
  if (years) {
    return years[0];
  }

  const shorthandYears = normalizedQuestion.match(/\b(\d{1,2})\s+cotizados\b/i);
  if (shorthandYears) {
    return `${shorthandYears[1]} anos cotizados`;
  }

  const months = normalizedQuestion.match(/\b(\d{1,3})\s+meses\s+cotizados\b/i);
  return months?.[0];
}

function extractUrgency(question: string): string | undefined {
  const normalizedQuestion = normalizeSearchText(question);

  if (/\bhoy\b|\burgente\b/.test(normalizedQuestion)) {
    return "hoy o urgente";
  }

  if (/\bmanana\b|\bpasado manana\b/.test(normalizedQuestion)) {
    return "desplazamiento inmediato";
  }

  if (/\besta semana\b|\bestos dias\b/.test(normalizedQuestion)) {
    return "esta semana";
  }

  if (/\beste mes\b|\bproximos dias\b/.test(normalizedQuestion)) {
    return "este mes";
  }

  return undefined;
}

function extractFacts(question: string, family: IntentFamily, operation: IntentOperation, benefitId?: string): Record<string, string> {
  const facts: Record<string, string> = {};
  const entry = getBenefitCatalogEntry(benefitId);
  const urgency = extractUrgency(question);

  if (urgency) {
    facts.urgencia = urgency;
  }

  const identification = extractMatchedValue(question, [
    { value: "certificado o Cl@ve", pattern: /\bcertificado digital\b/i },
    { value: "certificado o Cl@ve", pattern: /\bcl@ve\b/i },
    { value: "certificado o Cl@ve", pattern: /\bclave\b/i },
    { value: "via SMS", pattern: /\bsms\b/i },
    { value: "sin identificacion electronica", pattern: /\bsin certificado\b/i },
  ]);

  if (identification) {
    facts.identificacion = identification;
  }

  if (/\brequerimiento\b/i.test(question)) {
    facts.situacionExpediente = "con requerimiento";
  }

  if (/\bnotificacion(?:es)?\b/i.test(question) || /\bresolucion\b/i.test(question)) {
    facts.situacionExpediente = "con notificacion o resolucion";
  }

  if (/\bestado\b/i.test(question) || /\bseguimiento\b/i.test(question) || /\bmis expedientes\b/i.test(question)) {
    facts.situacionExpediente = "seguimiento de expediente";
  }

  if (operation === "reclamacion-previa" || /\breclamacion previa\b/i.test(question)) {
    facts.situacionExpediente = "preparando reclamacion previa";
  }

  if (operation === "silencio-administrativo" || /\bsilencio administrativo\b/i.test(question)) {
    facts.situacionExpediente = "sin respuesta expresa";
  }

  if (operation === "pago-cobro" || /\bcobro\b/i.test(question) || /\bpago\b/i.test(question)) {
    facts.situacionExpediente = "consulta sobre pago o cobro";
  }

  if (family === "jubilacion") {
    const modalidad = extractMatchedValue(question, [
      { value: "anticipada", pattern: /\banticipada\b/i },
      { value: "ordinaria", pattern: /\bordinaria\b/i },
      { value: "parcial", pattern: /\bparcial\b/i },
      { value: "demorada", pattern: /\bdemorada\b/i },
      { value: "SOVI", pattern: /\bsovi\b/i },
    ]);
    if (modalidad) {
      facts.modalidad = modalidad;
    }
    const edad = extractAge(question);
    if (edad) {
      facts.edad = edad;
    }
    const cotizacion = extractContribution(question);
    if (cotizacion) {
      facts.cotizacion = cotizacion;
    }
    const situacionLaboral = extractMatchedValue(question, [
      { value: "trabajando", pattern: /\btrabajando\b/i },
      { value: "desempleo o cese", pattern: /\bdesemplead/i },
      { value: "autonomo", pattern: /\bautonom/i },
      { value: "mutualista", pattern: /\bmutualista\b/i },
    ]);
    if (situacionLaboral) {
      facts.situacionLaboral = situacionLaboral;
    }
  }

  if (family === "incapacidad") {
    const tipoIncapacidad = extractMatchedValue(question, [
      { value: "temporal", pattern: /\btemporal\b/i },
      { value: "permanente", pattern: /\bpermanente\b/i },
      { value: "gran incapacidad", pattern: /\bgran incapacidad\b/i },
      { value: "lesiones permanentes no incapacitantes", pattern: /\blesiones permanentes no incapacitantes\b/i },
    ]);
    if (tipoIncapacidad) {
      facts.tipoIncapacidad = tipoIncapacidad;
    } else if (entry?.benefitId === "incapacidad-temporal") {
      facts.tipoIncapacidad = "temporal";
    } else if (entry?.benefitId === "incapacidad-permanente") {
      facts.tipoIncapacidad = "permanente";
    }

    const origen = extractMatchedValue(question, [
      { value: "contingencia comun", pattern: /\bcomun\b/i },
      { value: "accidente de trabajo", pattern: /\baccidente de trabajo\b/i },
      { value: "enfermedad profesional", pattern: /\benfermedad profesional\b/i },
    ]);
    if (origen) {
      facts.origen = origen;
    }
  }

  if (family === "familia-cuidados") {
    const supuesto = extractMatchedValue(question, [
      { value: "nacimiento o cuidado de menor", pattern: /\bnacimiento\b/i },
      { value: "adopcion o acogimiento", pattern: /\badopcion\b/i },
      { value: "cuidado de menor grave", pattern: /\benfermedad grave\b/i },
      { value: "riesgo durante el embarazo", pattern: /\bembarazo\b/i },
      { value: "riesgo durante la lactancia", pattern: /\blactancia\b/i },
      { value: "brecha de genero", pattern: /\bbrecha de genero\b/i },
    ]);
    if (supuesto) {
      facts.supuesto = supuesto;
    }

    const regimen = extractMatchedValue(question, [
      { value: "regimen general", pattern: /\bregimen general\b/i },
      { value: "autonomo", pattern: /\bautonom/i },
    ]);
    if (regimen) {
      facts.regimen = regimen;
    }
  }

  if (family === "supervivencia") {
    const tipoSupervivencia = extractMatchedValue(question, [
      { value: "viudedad", pattern: /\bviudedad\b/i },
      { value: "orfandad", pattern: /\borfandad\b/i },
      { value: "favor de familiares", pattern: /\bfavor de familiares\b/i },
      { value: "auxilio por defuncion", pattern: /\bauxilio por defuncion\b/i },
    ]);
    if (tipoSupervivencia) {
      facts.tipoSupervivencia = tipoSupervivencia;
    }

    const beneficiario = extractMatchedValue(question, [
      { value: "conyuge o pareja", pattern: /\bconyuge\b/i },
      { value: "hijo o hija", pattern: /\bhij[oa]\b/i },
      { value: "familiar", pattern: /\bfamiliar\b/i },
    ]);
    if (beneficiario) {
      facts.beneficiario = beneficiario;
    }
  }

  if (family === "asistencia-sanitaria") {
    const servicio = extractMatchedValue(question, [
      { value: "TSE o CPS", pattern: /\btse\b|\bcps\b|tarjeta sanitaria europea/i },
      { value: "alta de beneficiarios", pattern: /\bbeneficiari[oa]s?\b/i },
      { value: "asistencia sanitaria general", pattern: /\basistencia sanitaria\b/i },
    ]);
    if (servicio) {
      facts.servicioSanitario = servicio;
    }

    const destinatario = extractMatchedValue(question, [
      { value: "para la persona titular", pattern: /\bpara mi\b/i },
      { value: "para beneficiario", pattern: /\bbeneficiari[oa]s?\b/i },
      { value: "para viaje o desplazamiento", pattern: /\bviaj/i },
    ]);
    if (destinatario) {
      facts.destinatario = destinatario;
    }
  }

  if (family === "imv") {
    const fase = extractMatchedValue(question, [
      { value: "primera solicitud", pattern: /\bsolicitar\b/i },
      { value: "cambio de circunstancias", pattern: /\bcambio de circunstancias\b/i },
      { value: "seguimiento del expediente", pattern: /\bestado\b|\bseguimiento\b|\brequerimiento\b|\bnotificacion\b/i },
      { value: "pago o suspension", pattern: /\bcobro\b|\bpago\b|\bsuspension\b|\bextincion\b/i },
    ]);
    if (fase) {
      facts.fase = fase;
    }
  }

  if (family === "prestaciones-especiales") {
    const coberturaEspecial = extractMatchedValue(question, [
      { value: "seguro escolar", pattern: /\bseguro escolar\b/i },
      { value: "actos terroristas", pattern: /\bterrorismo\b|actos terroristas/i },
      { value: "violencia contra la mujer", pattern: /\bviolencia contra la mujer\b/i },
      { value: "Sindrome Toxico", pattern: /\bsindrome toxico\b/i },
      { value: "amianto", pattern: /\bamianto\b|asbestos/i },
    ]);
    if (coberturaEspecial) {
      facts.coberturaEspecial = coberturaEspecial;
    }
  }

  return facts;
}

const SLOT_SCHEMAS: Record<IntentFamily, SlotDefinition[]> = {
  general: [
    {
      key: "prestacion",
      label: "prestacion del INSS",
      question: "Que prestacion o tramite del INSS quieres revisar exactamente?",
      options: ["Jubilacion", "Incapacidad", "Nacimiento o familia", "IMV"],
      shouldAsk: (state) => !state.benefitId,
    },
  ],
  jubilacion: [
    {
      key: "modalidad",
      label: "modalidad de jubilacion",
      question: "Para orientarte bien, necesito saber una cosa: seria una jubilacion ordinaria (por edad), anticipada (antes de tiempo), parcial o alguna otra modalidad?",
      options: ["Ordinaria", "Anticipada", "Parcial", "SOVI"],
      shouldAsk: (state, question) => !state.facts.modalidad && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "edad",
      label: "edad aproximada",
      question: "Que edad tienes ahora, mas o menos? Asi puedo calcular mejor tu situacion.",
      options: ["Menos de 63", "63 o 64", "65 o mas"],
      shouldAsk: (state, question) => !state.facts.edad && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "cotizacion",
      label: "cotizacion aproximada",
      question: "Y cuantos anos llevas cotizados, aunque sea de forma aproximada?",
      options: ["Menos de 15", "Entre 15 y 37", "37 o mas"],
      shouldAsk: (state, question) => !state.facts.cotizacion && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  incapacidad: [
    {
      key: "tipoIncapacidad",
      label: "tipo de incapacidad",
      question: "Para ayudarte mejor, es una baja temporal (estas de baja medica) o una incapacidad permanente?",
      options: ["Temporal", "Permanente", "Lesiones permanentes"],
      shouldAsk: (state, question) => !state.facts.tipoIncapacidad && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "origen",
      label: "origen de la contingencia",
      question: "Y el motivo es una enfermedad comun, un accidente de trabajo o una enfermedad profesional?",
      options: ["Comun", "Accidente de trabajo", "Enfermedad profesional"],
      shouldAsk: (state, question) => !state.facts.origen && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  "familia-cuidados": [
    {
      key: "supuesto",
      label: "supuesto familiar",
      question: "Cuentame un poco mas: es por nacimiento de un hijo, embarazo o lactancia, cuidado de un menor enfermo grave, u otro supuesto?",
      options: ["Nacimiento", "Menor grave", "Embarazo o lactancia", "Brecha de genero"],
      shouldAsk: (state, question) => !state.facts.supuesto && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "regimen",
      label: "regimen o situacion laboral",
      question: "Estas en regimen general, eres autonomo o es otro supuesto?",
      options: ["Regimen general", "Autonomo", "Otro"],
      shouldAsk: (state, question) => !state.facts.regimen && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  supervivencia: [
    {
      key: "tipoSupervivencia",
      label: "prestacion de supervivencia",
      question: "Entiendo que es un momento dificil. Para orientarte bien, necesito saber si se trata de una pension de viudedad, orfandad, prestacion en favor de familiares o auxilio por defuncion.",
      options: ["Viudedad", "Orfandad", "Favor de familiares", "Auxilio por defuncion"],
      shouldAsk: (state, question) => !state.facts.tipoSupervivencia && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "beneficiario",
      label: "beneficiario principal",
      question: "La persona beneficiaria seria conyuge o pareja, hijo o hija, o familiar?",
      options: ["Conyuge o pareja", "Hijo o hija", "Familiar"],
      shouldAsk: (state, question) => !state.facts.beneficiario && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  "asistencia-sanitaria": [
    {
      key: "servicioSanitario",
      label: "tramite sanitario",
      question: "Necesitas TSE o CPS, alta de beneficiarios o un tramite sanitario general?",
      options: ["TSE o CPS", "Alta de beneficiarios", "Otro tramite sanitario"],
      shouldAsk: (state, question) => !state.facts.servicioSanitario && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "destinatario",
      label: "destinatario del tramite",
      question: "El tramite es para ti, para un beneficiario o para un viaje o desplazamiento?",
      options: ["Para mi", "Para beneficiario", "Para viaje"],
      shouldAsk: (state, question) => !state.facts.destinatario && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  imv: [
    {
      key: "fase",
      label: "fase del IMV",
      question: "Es primera solicitud, cambio de circunstancias, seguimiento, o un problema de pago o suspension?",
      options: ["Primera solicitud", "Cambio de circunstancias", "Seguimiento", "Pago o suspension"],
      shouldAsk: (state, question) => !state.facts.fase && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  "operativa-inss": [
    {
      key: "identificacion",
      label: "via de identificacion",
      question: "Tienes certificado o Cl@ve, quieres usar SMS o estas sin identificacion electronica?",
      options: ["Certificado o Cl@ve", "Via SMS", "Sin identificacion"],
      shouldAsk: (state, question) => !state.facts.identificacion && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "situacionExpediente",
      label: "situacion del expediente",
      question: "Estas siguiendo un expediente, tienes un requerimiento o ya hay notificacion o resolucion?",
      options: ["Seguimiento", "Requerimiento", "Notificacion o resolucion"],
      shouldAsk: (state, question) => !state.facts.situacionExpediente && /mi|me|tengo|quiero/i.test(question),
    },
  ],
  "prestaciones-especiales": [
    {
      key: "coberturaEspecial",
      label: "prestacion especial",
      question: "Tu caso encaja con seguro escolar, terrorismo, violencia contra la mujer, Sindrome Toxico o Amianto?",
      options: ["Seguro escolar", "Terrorismo", "Violencia", "Otro supuesto especial"],
      shouldAsk: (state, question) => !state.facts.coberturaEspecial && /mi|me|tengo|quiero/i.test(question),
    },
    {
      key: "situacionEspecial",
      label: "supuesto o riesgo concreto",
      question: "Que supuesto concreto quieres revisar dentro de esa prestacion especial?",
      options: ["Requisitos o beneficiarios", "Documentos o tramite", "Seguimiento o resolucion"],
      shouldAsk: (state, question) => !state.facts.situacionExpediente && /mi|me|tengo|quiero/i.test(question),
    },
  ],
};

function resolveBenefitId(question: string, incomingState: ChatState, operation: IntentOperation): string | undefined {
  const detected = detectBenefitId(question);
  if (detected) {
    return detected;
  }

  if (incomingState.benefitId && (SENSITIVE_OPERATIONS.has(operation) || isContextualFollowUp(question))) {
    return incomingState.benefitId;
  }

  return undefined;
}

function resolveFamily(
  question: string,
  detectedFamily: IntentFamily,
  benefitId: string | undefined,
  incomingState: ChatState,
  operation: IntentOperation,
): IntentFamily {
  const fromBenefit = getBenefitCatalogEntry(benefitId)?.family;
  if (fromBenefit) {
    return fromBenefit;
  }

  if (detectedFamily !== "general") {
    return detectedFamily;
  }

  if ((SENSITIVE_OPERATIONS.has(operation) || isContextualFollowUp(question)) && incomingState.family !== "general") {
    return incomingState.family;
  }

  return detectedFamily;
}

function shouldResetFacts(previousState: ChatState, nextBenefitId: string | undefined): boolean {
  return Boolean(previousState.benefitId && nextBenefitId && previousState.benefitId !== nextBenefitId);
}

function buildMissingSlots(state: ChatState, question: string): SlotDefinition[] {
  const slots = SLOT_SCHEMAS[state.family] ?? SLOT_SCHEMAS.general;
  return slots.filter((slot) => slot.shouldAsk(state, question));
}

function isBlockingSlot(state: ChatState, slot: SlotDefinition): boolean {
  const blockingKeys = BLOCKING_SLOT_KEYS_BY_FAMILY[state.family] ?? [];
  return blockingKeys.includes(slot.key);
}

function isFirstApplicationJourney(state: ChatState): boolean {
  return ["descubrimiento", "orientacion", "preparacion", "presentacion"].includes(state.lifecycleStage);
}

function buildCaseSummary(state: ChatState): string {
  const entry = getBenefitCatalogEntry(state.benefitId);
  const label = entry?.displayName ?? state.family.replace(/-/g, " ");
  const facts = Object.values(state.factsConfirmed).slice(0, 3);

  if (facts.length === 0) {
    return `Caso abierto sobre ${label}.`;
  }

  return `Caso abierto sobre ${label}: ${facts.join(", ")}.`;
}

function buildClarifyingOptionPrompt(slotKey: string, option: string): string {
  if (slotKey === "edad") {
    return `Tengo ${option}.`;
  }

  if (slotKey === "cotizacion") {
    return `He cotizado ${option}.`;
  }

  if (slotKey === "identificacion") {
    return `Quiero usar ${option}.`;
  }

  if (slotKey === "situacionExpediente") {
    return `La situacion del expediente es ${option}.`;
  }

  return `Mi caso es ${option}.`;
}

function buildClarifyingActions(state: ChatState, slots: SlotDefinition[]): RecommendedAction[] {
  const firstSlot = slots[0];

  if (!firstSlot) {
    return [];
  }

  return firstSlot.options.slice(0, 4).map((option, index) => ({
    id: `clarify:${firstSlot.key}:${index}`,
    label: option,
    prompt: buildClarifyingOptionPrompt(firstSlot.key, option),
  }));
}

function buildRecommendedFollowUpActions(state: ChatState): RecommendedAction[] {
  const entry = getBenefitCatalogEntry(state.benefitId);
  const benefitLabel = entry?.displayName ?? "este tramite";
  const stage = state.lifecycleStage;

  if (stage === "seguimiento" || stage === "resolucion") {
    return [
      {
        id: "track",
        label: "Seguir expediente",
        prompt: `Como sigo un expediente de ${benefitLabel} y que via oficial debo usar ahora`,
      },
      {
        id: "requirement",
        label: "Si hay requerimiento",
        prompt: `Si me llega un requerimiento en ${benefitLabel}, que debo revisar primero`,
      },
      {
        id: "notification",
        label: "Si hay notificacion",
        prompt: `Si recibo una notificacion o resolucion en ${benefitLabel}, cual es el siguiente paso prudente`,
      },
      {
        id: "review",
        label: "Revisar reclamacion",
        prompt: `Quiero revisar si cabe reclamacion previa en ${benefitLabel}`,
      },
    ];
  }

  if (stage === "revision") {
    return [
      {
        id: "review",
        label: "Preparar reclamacion",
        prompt: `Quiero ordenar una reclamacion previa en ${benefitLabel}`,
      },
      {
        id: "docs",
        label: "Ordenar documentos",
        prompt: `Que documentos conviene ordenar para revisar ${benefitLabel}`,
      },
      {
        id: "status",
        label: "Ver estado",
        prompt: `Como reviso el estado del expediente de ${benefitLabel}`,
      },
    ];
  }

  return [
    {
      id: "documents",
      label: "Ver documentos",
      prompt: `Quiero ver documentos habituales para ${benefitLabel}`,
    },
    {
      id: "submit",
      label: "Como presentarlo",
      prompt: `Como se presenta ${benefitLabel} y que via oficial me conviene`,
    },
    {
      id: "changes",
      label: "Que cambia si...",
      prompt: `Que datos cambian la orientacion en ${benefitLabel}`,
    },
    {
      id: "track",
      label: "Seguir expediente",
      prompt: `Como sigo un expediente de ${benefitLabel} despues de presentarlo`,
    },
  ];
}

function buildRetrievalQuestion(question: string, state: ChatState): string {
  const entry = getBenefitCatalogEntry(state.benefitId);
  const facts = Object.entries(state.factsConfirmed)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return [
    question,
    entry ? `prestacion ${entry.displayName}` : "",
    `familia ${state.family}`,
    `operacion ${state.operation}`,
    `etapa ${state.lifecycleStage}`,
    facts ? `hechos ${facts}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function analyzeConversation(question: string, state?: ChatState): ConversationAnalysis {
  const incomingState = normalizeIncomingState(state);
  const detectedOperation = detectOperation(question);
  const benefitId = resolveBenefitId(question, incomingState, detectedOperation);
  const detectedFamily = detectFamily(question);
  const family = resolveFamily(question, detectedFamily, benefitId, incomingState, detectedOperation);
  const lifecycleStage =
    detectedOperation !== "general"
      ? OPERATION_STAGE_MAP[detectedOperation]
      : benefitId && !isCaseSpecific(question, detectedOperation)
        ? "orientacion"
        : incomingState.lifecycleStage ?? "descubrimiento";
  const shouldReset = shouldResetFacts(incomingState, benefitId);
  const baseFacts = shouldReset ? {} : { ...incomingState.facts };
  const extractedFacts = extractFacts(question, family, detectedOperation, benefitId);
  const facts = {
    ...baseFacts,
    ...extractedFacts,
  };

  const nextState: ChatState = {
    family,
    operation:
      detectedOperation === "general" && incomingState.operation !== "general" && isContextualFollowUp(question)
        ? incomingState.operation
        : detectedOperation,
    benefitId: benefitId ?? incomingState.benefitId,
    lifecycleStage,
    facts,
    missingFacts: [],
    factsConfirmed: facts,
    factsPending: [],
    caseSummary: "",
    lastRecommendedAction: incomingState.lastRecommendedAction ?? "",
    updatedAt: new Date().toISOString(),
  };

  const missingSlots = buildMissingSlots(nextState, question);
  const blockingMissingSlots = missingSlots.filter((slot) => isBlockingSlot(nextState, slot));
  nextState.missingFacts = missingSlots.map((slot) => slot.label);
  nextState.factsPending = nextState.missingFacts;
  nextState.caseSummary = buildCaseSummary(nextState);

  const clarifyLimit = 1;
  const shouldClarify =
    blockingMissingSlots.length > 0 &&
    isCaseSpecific(question, nextState.operation) &&
    isFirstApplicationJourney(nextState);

  const clarifyingQuestions = shouldClarify ? blockingMissingSlots.slice(0, clarifyLimit).map((slot) => slot.question) : [];
  const recommendedActions = shouldClarify
    ? buildClarifyingActions(nextState, blockingMissingSlots.slice(0, clarifyLimit))
    : buildRecommendedFollowUpActions(nextState).slice(0, 4);
  const suggestedReplies = recommendedActions.map((action) => action.prompt);

  return {
    intent: {
      family: nextState.family,
      operation: nextState.operation,
      benefitId: nextState.benefitId,
      lifecycleStage: nextState.lifecycleStage,
    },
    state: nextState,
    shouldClarify,
    clarifyingQuestions,
    recommendedActions,
    suggestedReplies,
    retrievalQuestion: buildRetrievalQuestion(question, nextState),
  };
}

export function isTelegramStateExpired(state?: ChatState, maxAgeMs = 30 * 60 * 1000): boolean {
  if (!state?.updatedAt) {
    return true;
  }

  const updatedAt = new Date(state.updatedAt).getTime();

  if (Number.isNaN(updatedAt)) {
    return true;
  }

  return Date.now() - updatedAt > maxAgeMs;
}

export function buildClarificationSummary(state: ChatState): string {
  const entry = getBenefitCatalogEntry(state.benefitId);
  const label = entry?.displayName ?? state.family.replace(/-/g, " ");

  if (state.missingFacts.length === 0) {
    return `Con lo que me has contado ya puedo seguir orientandote sobre ${label}.`;
  }

  return `Necesito un dato mas para poder orientarte bien sobre ${label}: ${state.missingFacts.join(", ")}.`;
}
