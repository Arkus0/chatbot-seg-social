import type { RetrievedChunk } from "../types/documents.js";
import { countTokenMatches, tokenizeSearchText } from "../utils/text.js";
import { benefitCatalogUrlMatches, type BenefitUrlField } from "./inssCatalog.js";

export interface RetrievalIntentContext {
  benefitId?: string;
  family?: string;
  operation?: string;
  lifecycle?: string;
}

const SPANISH_STOPWORDS = new Set([
  "como",
  "para",
  "que",
  "con",
  "del",
  "las",
  "los",
  "una",
  "unas",
  "unos",
  "por",
  "sin",
  "sobre",
  "desde",
  "hasta",
  "cuando",
  "donde",
  "puedo",
  "necesito",
  "quiero",
  "solicitar",
  "consultar",
  "hacer",
]);

const EXPANSION_RULES = [
  {
    pattern: /\bvida laboral\b/i,
    expansion: "informe de tu vida laboral altas bajas regimenes seguridad social importass",
  },
  {
    pattern: /\bnuss\b|\bnaf\b|numero de la seguridad social|n[uú]mero de la seguridad social/i,
    expansion: "solicitar numero de la seguridad social acreditacion nuss naf afiliacion importass",
  },
  {
    pattern: /\bautonom/i,
    expansion: "alta en trabajo autonomo baja en trabajo autonomo reta actividad economica importass",
  },
  {
    pattern: /\bemplead[oa] de hogar\b|empleo de hogar|trabajadora del hogar/i,
    expansion: "alta en empleo de hogar baja en empleo de hogar cotizacion hogar importass",
  },
  {
    pattern: /\bjubil/i,
    expansion: "pension de jubilacion procedimiento solicitud requisitos documentacion edad retiro",
  },
  {
    pattern: /\banticipada\b|jubilarme antes|jubilacion antes de tiempo|jubilacion anticipada/i,
    expansion: "jubilacion anticipada edad coeficientes reductores acceso pension requisitos",
  },
  {
    pattern: /\bmutualista\b|condicion de mutualista|mutualidad laboral/i,
    expansion: "jubilacion anticipada mutualista edad real 60 anos mutualidad laboral coeficientes reductores",
  },
  {
    pattern: /\bdemorada\b|retrasar la jubilacion|jubilacion demorada/i,
    expansion: "jubilacion demorada demora pension incentivos complemento demora",
  },
  {
    pattern: /\bjubilacion parcial\b|contrato de relevo|reducir jornada y cobrar pension/i,
    expansion: "jubilacion parcial contrato relevo trabajo parcial pension requisitos",
  },
  {
    pattern: /\bdiscapacidad\b|jubilacion anticipada por discapacidad/i,
    expansion: "jubilacion anticipada por discapacidad coeficientes edad discapacidad acreditacion",
  },
  {
    pattern: /\bedad de jubilacion\b|edad de jubilacion|jubilarme a los|cuando me puedo jubilar/i,
    expansion: "jubilacion ordinaria requisitos edad periodo minimo de cotizacion acceso pension",
  },
  {
    pattern: /\bsimular\b|\bsimulador\b|calcular mi jubilacion|calcular mi pension/i,
    expansion: "simulador de jubilacion tu seguridad social sms calculo pension futura",
  },
  {
    pattern: /\bincapacidad temporal\b|baja medica/i,
    expansion: "prestacion de incapacidad temporal subsidio baja medica enfermedad accidente procedimiento",
  },
  {
    pattern: /\bincapacidad permanente\b|invalidez/i,
    expansion: "incapacidad permanente concepto grados invalidez pension trabajador",
  },
  {
    pattern: /\bportal de prestaciones\b|\bprestaciones\.seg-social\b/i,
    expansion: "portal de prestaciones de la seguridad social solicitudes comunicaciones servicios inss",
  },
  {
    pattern: /\bmis expedientes\b|\bexpediente\b|\bseguimiento\b|\bestado de mi solicitud\b/i,
    expansion: "mis expedientes administrativos seguimiento expediente inss estado de solicitud seguridad social",
  },
  {
    pattern: /\bincapacidad permanente parcial\b|incapacidad parcial|lesiones permanentes no incapacitantes|lesiones permanentes no invalidantes/i,
    expansion: "incapacidad permanente parcial indemnizacion prestacion lesiones permanentes no incapacitantes formulario solicitud",
  },
  {
    pattern: /\bincapacidad permanente absoluta\b|invalidez absoluta|incapacidad absoluta/i,
    expansion: "incapacidad permanente absoluta pension trabajo profesion habitual formulario solicitud inss",
  },
  {
    pattern: /\bgran incapacidad\b/i,
    expansion: "gran incapacidad complemento tercera persona pension incapacidad permanente",
  },
  {
    pattern: /\brellenar\b|\bcumplimentar\b|\bcasilla\b|\bformulario\b|\bmodelo\b|\bimpreso\b/i,
    expansion: "solicitud formulario cumplimentar casillas datos identificativos documentacion datos bancarios firmas",
  },
  {
    pattern: /\bembarazo\b|riesgo durante el embarazo/i,
    expansion: "riesgo durante el embarazo prestacion suspension contrato requisitos cuantia",
  },
  {
    pattern: /\blactancia\b|riesgo durante la lactancia/i,
    expansion: "riesgo durante la lactancia natural prestacion suspension contrato requisitos cuantia",
  },
  {
    pattern: /\bnacimiento\b|cuidado de menor|maternidad|paternidad/i,
    expansion: "nacimiento y cuidado de menor prestacion permiso descanso subsidio seguridad social solicitud",
  },
  {
    pattern: /\bcertificado provisional sustitutorio\b|\bcps\b/i,
    expansion: "certificado provisional sustitutorio tarjeta sanitaria europea tse urgencia viaje asistencia sanitaria europa",
  },
  {
    pattern: /\bviudedad\b/i,
    expansion: "pension de viudedad beneficiarios requisitos causantes muerte supervivencia solicitud",
  },
  {
    pattern: /\borfandad\b/i,
    expansion: "pension de orfandad beneficiarios requisitos muerte supervivencia",
  },
  {
    pattern: /\bimv\b|ingreso minimo vital/i,
    expansion: "ingreso minimo vital solicitud documentacion portal prestaciones seguridad social",
  },
  {
    pattern: /\bayuda a la infancia\b|ayuda para la infancia|complemento infancia/i,
    expansion: "complemento de ayuda para la infancia imv hijos menores unidad de convivencia",
  },
  {
    pattern: /\bbrecha de genero\b|complemento por maternidad|complemento por hijos/i,
    expansion: "complemento para la reduccion de la brecha de genero pension hijos solicitud",
  },
  {
    pattern: /\bauxilio por defuncion\b|gastos de sepelio|gastos de entierro/i,
    expansion: "auxilio por defuncion gastos de sepelio fallecimiento ayuda economica seguridad social",
  },
  {
    pattern: /\bfavor de familiares\b/i,
    expansion: "pension en favor de familiares subsidio en favor de familiares fallecimiento solicitud",
  },
  {
    pattern: /\bcancer\b|enfermedad grave del menor|cuidado de menores afectados/i,
    expansion: "cuidado de menores afectados por cancer u otra enfermedad grave reduccion jornada prestacion",
  },
  {
    pattern: /\btse\b|tarjeta sanitaria europea/i,
    expansion: "tarjeta sanitaria europea tse certificado provisional sustitutorio cps solicitud renovacion asistencia sanitaria estancia temporal",
  },
  {
    pattern: /\bbeneficiari[oa]s?\b|alta de beneficiari[oa]s?/i,
    expansion: "beneficiario asistencia sanitaria alta de beneficiarios titular derecho tarjeta sanitaria solicitud",
  },
  {
    pattern: /\btrabajador(?:es)? del mar\b|\bregimen especial del mar\b|\binstituto social de la marina\b|\bism\b/i,
    expansion: "instituto social de la marina ism regimen especial de trabajadores del mar prestaciones solicitud sede electronica",
  },
  {
    pattern: /\bcita previa\b|pedir cita|solicitar cita/i,
    expansion: "cita previa seguridad social pensiones prestaciones inss canales de atencion",
  },
  {
    pattern: /\bdonde presento\b|\bdonde se presenta\b|\bcomo presentarl[oa]\b|\bpor internet\b|\bpresencial\b/i,
    expansion:
      "presentacion sede electronica portal de prestaciones solicitudes y tramites cita previa caiss por internet presencial",
  },
  {
    pattern: /\bsin certificado\b|sin clave|sin cl@ve|via sms/i,
    expansion: "tramites sin certificado digital ni clave presentacion telematica via sms inss seguridad social",
  },
  {
    pattern: /\bestado de mi solicitud\b|estado de la solicitud|seguimiento del expediente|como va mi solicitud/i,
    expansion: "consultar estado de solicitud seguimiento expediente via sms seguridad social imv prestacion",
  },
  {
    pattern:
      /\bsubsan(ar|acion)\b|aportar documentacion|adjuntar documentos|enviar documentacion adicional|requerimiento\b/i,
    expansion:
      "subsanacion de expediente requerimiento de documentacion aportar documentos faltantes mis expedientes administrativos inss",
  },
  {
    pattern: /\bnotificacion\b|resolucion\b|denegacion\b|recurso\b/i,
    expansion:
      "notificaciones de seguridad social resolucion denegacion prestaciones revision administrativa estado de expediente",
  },
  {
    pattern: /\bcaiss\b|centro de atencion e informacion|atencion presencial inss/i,
    expansion: "caiss centro de atencion e informacion de la seguridad social cita previa inss atencion presencial",
  },
  {
    pattern: /\bportal prestaciones\b|\bsolicitudes y comunicaciones\b/i,
    expansion: "solicitudes y comunicaciones de prestaciones de la seguridad social inss portal de prestaciones",
  },
  {
    pattern: /\bcertificado digital\b/i,
    expansion: "certificado digital electronico fnmt instalacion renovacion exportar error navegador sede seguridad social",
  },
  {
    pattern: /\bautofirma\b/i,
    expansion: "autofirma firma electronica error java instalacion configuracion navegador sede seguridad social",
  },
  {
    pattern: /\bcl@ve\b|\bclave pin\b|\bclave permanente\b/i,
    expansion: "clave pin permanente registro identificacion electronica acceso sede seguridad social",
  },
  {
    pattern: /\bdnie?\b/i,
    expansion: "dnie electronico lector tarjeta certificado identificacion sede seguridad social",
  },
  {
    pattern: /\bno me deja\b.*(?:firmar|entrar|acceder)|\bno funciona\b.*(?:firma|sede|certificado)/i,
    expansion: "error acceso sede electronica certificado autofirma firma navegador clave identificacion",
  },
  {
    pattern: /\bcertificado\b|\bsin identificacion\b/i,
    expansion: "identificacion certificado digital clave sms sin certificado seguridad social inss",
  },
  {
    pattern: /\bconvenio especial\b/i,
    expansion: "convenio especial seguridad social alta baja variacion solicitud cotizacion voluntaria",
  },
  {
    pattern: /\bpracticas\b|pr[aá]cticas formativas|recuperar anos cotizados/i,
    expansion: "practicas formativas cotizacion antiguas practicas convenio especial recuperar anos cotizados",
  },
  {
    pattern: /\bperiodo minimo de cotizacion\b|periodos minimos de cotizacion|carencia/i,
    expansion: "periodos minimos de cotizacion carencia prestaciones seguridad social dias cotizados",
  },
  {
    pattern: /\bcertificado integral de prestaciones\b|certificado de prestaciones/i,
    expansion: "certificado integral de prestaciones prestaciones percibidas certificado seguridad social",
  },
  {
    pattern: /\bdocumentacion\b|papeles|documentos/i,
    expansion: "documentacion solicitud requisitos justificantes formulario tramite",
  },
  {
    pattern: /\bque aportar\b|\bque adjuntar\b|\bque me van a pedir\b/i,
    expansion: "documentacion aportar adjuntar justificantes formularios datos necesarios solicitud",
  },
  {
    pattern: /\bmodelo\b|modelo oficial|impreso oficial|formulario oficial/i,
    expansion: "modelo oficial impreso oficial formulario de solicitud pdf sede seguridad social",
  },
  {
    pattern: /\bcuantia\b|importe|cuanto cobro/i,
    expansion: "cuantia importe porcentaje base reguladora abono pension prestacion",
  },
  {
    pattern: /\bsovi\b|seguro obligatorio de vejez e invalidez/i,
    expansion: "sovi pension seguro obligatorio de vejez e invalidez requisitos compatibilidades solicitud",
  },
  {
    pattern: /\bseguro escolar\b/i,
    expansion: "seguro escolar beneficiarios riesgos cubiertos incompatibilidades gestion solicitud",
  },
  {
    pattern: /\bterrorismo\b|actos terroristas/i,
    expansion: "prestaciones por actos terroristas pensiones extraordinarias asistencia sanitaria servicios sociales",
  },
  {
    pattern: /\bviolencia contra la mujer\b|violencia de genero/i,
    expansion: "prestaciones por violencia contra la mujer seguridad social inss",
  },
  {
    pattern: /\bsindrome toxico\b/i,
    expansion: "prestaciones por sindrome toxico seguridad social inss",
  },
  {
    pattern: /\bamianto\b|asbestos/i,
    expansion: "prestaciones por amianto seguridad social inss",
  },
  {
    pattern: /\bembarazada\b|estoy embarazada|me he quedado embarazada/i,
    expansion: "nacimiento cuidado de menor riesgo durante el embarazo prestacion maternidad subsidio",
  },
  {
    pattern: /\bha fallecido\b|\bse (?:me )?ha muerto\b|\bmuerte\b|\bfallecimiento\b/i,
    expansion: "pension viudedad orfandad supervivencia auxilio defuncion fallecimiento",
  },
  {
    pattern: /\bno puedo trabajar\b|\bme duele\b|\bestoy enferm/i,
    expansion: "incapacidad temporal baja medica enfermedad subsidio prestacion",
  },
  {
    pattern: /\bcuanto (?:voy a )?cobr/i,
    expansion: "cuantia base reguladora importe pension prestacion porcentaje abono",
  },
  {
    pattern: /\bextranjer[oa]?\b|\bno tengo papeles\b|\binmigrante\b/i,
    expansion: "asistencia sanitaria convenio bilateral extranjero residencia autorizacion seguridad social",
  },
  {
    pattern: /\bdivorcio\b|\bex\s?(?:marido|mujer|conyuge|pareja)\b/i,
    expansion: "pension compensatoria viudedad exconyuge divorciado separacion",
  },
  {
    pattern: /\bno llego a fin de mes\b|\bayuda economica\b|\bno tengo (?:dinero|ingresos)\b/i,
    expansion: "ingreso minimo vital imv solicitud prestacion no contributiva ayuda economica",
  },
  {
    pattern: /\bcobrar la pension\b|\bcuando cobro\b|\bfecha de pago\b|\bno me han pagado\b/i,
    expansion: "pago cobro abono pension prestacion fecha nomina transferencia",
  },
  {
    pattern: /\baccidente\s+(de\s+)?trabajo\b|\baccidente laboral\b/i,
    expansion: "accidente de trabajo contingencia profesional incapacidad prestacion mutua colaboradora",
  },
];

function tokenize(input: string): string[] {
  return tokenizeSearchText(input, {
    stopwords: SPANISH_STOPWORDS,
  });
}

type IntentScoringRule = {
  name: string;
  anyTokens: string[];
  allTokens?: string[];
  boostTags?: string[];
  penalizeTags?: string[];
  boostAmount?: number;
  penaltyAmount?: number;
};

const INTENT_SCORING_RULES: IntentScoringRule[] = [
  {
    name: "parenthood-benefit",
    anyTokens: ["paternidad", "maternidad", "nacimiento"],
    allTokens: ["cuidado", "menor"],
    boostTags: ["nacimiento", "cuidado-menor"],
    penalizeTags: ["nuss"],
    boostAmount: 0.2,
    penaltyAmount: 0.16,
  },
  {
    name: "inss-operations",
    anyTokens: ["expediente", "requerimiento", "subsanacion", "notificacion"],
    boostTags: [
      "operativa-inss",
      "estado-expediente",
      "estado-solicitud",
      "subsanacion",
      "subsanacion-requerimiento",
      "requerimiento",
      "notificacion",
    ],
    boostAmount: 0.24,
  },
  {
    name: "health-assistance",
    anyTokens: ["tse", "cps", "beneficiario", "sanitaria", "sanitario"],
    boostTags: ["asistencia-sanitaria", "tse", "cps", "beneficiario"],
    boostAmount: 0.2,
  },
  {
    name: "survival-benefits",
    anyTokens: ["viudedad", "orfandad", "fallecimiento"],
    boostTags: ["supervivencia", "viudedad", "orfandad", "favor-de-familiares"],
    boostAmount: 0.18,
  },
  {
    name: "form-guidance",
    anyTokens: ["rellenar", "cumplimentar", "casilla", "formulario", "modelo"],
    boostTags: ["formulario", "rellenar", "solicitud"],
    boostAmount: 0.18,
  },
];

function matchesIntentRule(questionTokens: string[], rule: IntentScoringRule): boolean {
  const anyMatch = rule.anyTokens.some((token) => questionTokens.includes(token));
  const allMatch = rule.allTokens ? rule.allTokens.every((token) => questionTokens.includes(token)) : false;

  return anyMatch || allMatch;
}

function getIntentScoreAdjustments(questionTokens: string[], chunk: RetrievedChunk): number {
  let score = 0;

  for (const rule of INTENT_SCORING_RULES) {
    if (!matchesIntentRule(questionTokens, rule)) {
      continue;
    }

    if (rule.boostTags?.some((tag) => chunk.metadata.tags.includes(tag))) {
      score += rule.boostAmount ?? 0;
    }

    if (rule.penalizeTags?.some((tag) => chunk.metadata.tags.includes(tag))) {
      score -= rule.penaltyAmount ?? 0;
    }
  }

  return score;
}

function applySourceDiversity(
  primaryChunks: RetrievedChunk[],
  topK: number,
  maxPerUrl = 2,
  fallbackChunks: RetrievedChunk[] = [],
): RetrievedChunk[] {
  const perUrl = new Map<string, number>();
  const selected: RetrievedChunk[] = [];
  const seenKeys = new Set<string>();

  for (const chunk of [...primaryChunks, ...fallbackChunks]) {
    const url = chunk.metadata.url;
    const key = `${url}:${chunk.metadata.chunkIndex}`;
    const currentCount = perUrl.get(url) ?? 0;

    if (currentCount >= maxPerUrl || seenKeys.has(key)) {
      continue;
    }

    perUrl.set(url, currentCount + 1);
    seenKeys.add(key);
    selected.push(chunk);

    if (selected.length >= topK) {
      break;
    }
  }

  return selected;
}

function getExpectedSourceKinds(operation?: string): string[] {
  switch (operation) {
    case "rellenado-formulario":
      return ["form", "benefit-page"];
    case "subsanacion-requerimiento":
    case "notificacion":
      return ["notification", "tracking", "service"];
    case "estado-expediente":
      return ["tracking", "service"];
    case "cita-caiss":
      return ["service"];
    case "sin-certificado-sms":
      return ["service", "tracking"];
    case "revision":
    case "reclamacion-previa":
    case "silencio-administrativo":
      return ["review", "notification", "tracking"];
    case "documentacion":
      return ["benefit-page", "service", "form"];
    case "solicitud":
      return ["service", "benefit-page", "form"];
    default:
      return ["benefit-page", "service"];
  }
}

function isPreparationFocusedQuestion(questionTokens: string[], context?: RetrievalIntentContext): boolean {
  return (
    questionTokens.some((token) =>
      ["rellenar", "cumplimentar", "casilla", "formulario", "modelo", "impreso", "documentacion", "documentos", "papeles", "justificantes", "adjuntar", "aportar"].includes(token),
    ) ||
    context?.operation === "rellenado-formulario" ||
    context?.operation === "documentacion"
  );
}

function isTseComparisonQuestion(questionTokens: string[]): boolean {
  return questionTokens.some((token) => ["tse", "cps", "urgente", "viajar", "viaje"].includes(token));
}

function isStudyFocusedQuestion(questionTokens: string[]): boolean {
  return questionTokens.some((token) => ["estudios", "erasmus", "universidad", "universitario", "programa", "oficial"].includes(token));
}

function isTseStudyEdgeCaseChunk(chunk: RetrievedChunk): boolean {
  const haystack = `${chunk.metadata.title} ${chunk.metadata.searchText ?? ""} ${chunk.pageContent.slice(0, 700)}`.toLowerCase();
  return chunk.metadata.benefitId === "tse-cps" && /estudios|erasmus|titulo publico oficial|programas oficiales/.test(haystack);
}

function filterPeripheralChunks(
  ranked: RetrievedChunk[],
  questionTokens: string[],
  context?: RetrievalIntentContext,
): RetrievedChunk[] {
  const allowStudySpecific = isStudyFocusedQuestion(questionTokens);
  const preparationFocused = isPreparationFocusedQuestion(questionTokens, context);

  return ranked.filter((chunk) => {
    if (!allowStudySpecific && isTseStudyEdgeCaseChunk(chunk)) {
      return false;
    }

    if (
      !preparationFocused &&
      chunk.metadata.sourceKind === "form" &&
      !(chunk.metadata.benefitId === "tse-cps" && isTseComparisonQuestion(questionTokens)) &&
      ranked.some(
        (alternative) =>
          alternative !== chunk &&
          alternative.metadata.benefitId === chunk.metadata.benefitId &&
          alternative.metadata.sourceKind !== "form" &&
          (alternative.rerankScore ?? alternative.score) >= (chunk.rerankScore ?? chunk.score) - 0.16,
      )
    ) {
      return false;
    }

    return true;
  });
}

function getPreferredCatalogUrlKinds(operation?: string): BenefitUrlField[] {
  switch (operation) {
    case "rellenado-formulario":
    case "documentacion":
      return ["formUrls", "pdfUrls", "primaryUrls"];
    case "solicitud":
    case "sin-certificado-sms":
    case "cita-caiss":
    case "variacion-datos":
      return ["serviceUrls", "primaryUrls"];
    case "estado-expediente":
    case "subsanacion-requerimiento":
    case "notificacion":
      return ["trackingUrls", "notificationUrls", "serviceUrls"];
    case "revision":
    case "reclamacion-previa":
    case "silencio-administrativo":
      return ["reviewUrls", "notificationUrls", "trackingUrls"];
    default:
      return ["primaryUrls", "serviceUrls"];
  }
}

function isAllowedOperationalChunk(context: RetrievalIntentContext | undefined, chunk: RetrievedChunk): boolean {
  return Boolean(
    context?.benefitId &&
      chunk.metadata.benefitId === "operativa-inss" &&
      benefitCatalogUrlMatches(context.benefitId, chunk.metadata.url),
  );
}

function computeContextBoost(context: RetrievalIntentContext | undefined, chunk: RetrievedChunk): number {
  if (!context) {
    return 0;
  }

  let boost = 0;
  const allowOperationalChunk = isAllowedOperationalChunk(context, chunk);

  if (context.benefitId && chunk.metadata.benefitId === context.benefitId) {
    boost += 0.22;
  } else if (allowOperationalChunk) {
    boost += 0.14;
  } else if (context.benefitId && chunk.metadata.benefitId && chunk.metadata.benefitId !== context.benefitId) {
    boost -= 0.08;
  } else if (context.family && chunk.metadata.family === context.family) {
    boost += 0.08;
  } else if (context.family && chunk.metadata.family && chunk.metadata.family !== context.family) {
    boost -= 0.03;
  }

  if (context.lifecycle && chunk.metadata.lifecycle === context.lifecycle) {
    boost += 0.12;
  }

  if (context.operation) {
    const expectedKinds = getExpectedSourceKinds(context.operation);
    if (chunk.metadata.sourceKind && expectedKinds.includes(chunk.metadata.sourceKind)) {
      boost += 0.11;
    }

    if (
      context.benefitId &&
      benefitCatalogUrlMatches(context.benefitId, chunk.metadata.url, getPreferredCatalogUrlKinds(context.operation))
    ) {
      boost += 0.18;
    }

    if (context.operation === "sin-certificado-sms") {
      boost += chunk.metadata.supportsSms ? 0.16 : -0.04;
      boost += chunk.metadata.requiresAuth ? -0.04 : 0.02;
    }
  }

  return boost;
}

function computeBoost(questionTokens: string[], chunk: RetrievedChunk, context?: RetrievalIntentContext): number {
  const titleMatches = countTokenMatches(questionTokens, chunk.metadata.title);
  const tagMatches = countTokenMatches(questionTokens, chunk.metadata.tags.join(" "));
  const searchMatches = countTokenMatches(
    questionTokens,
    chunk.metadata.searchText ?? `${chunk.metadata.title} ${chunk.metadata.tags.join(" ")}`,
  );
  const contentMatches = countTokenMatches(questionTokens, chunk.pageContent.slice(0, 500));
  const preparationFocused = isPreparationFocusedQuestion(questionTokens, context);

  let boost = 0;
  boost += Math.min(titleMatches * 0.05, 0.2);
  boost += Math.min(tagMatches * 0.08, 0.24);
  boost += Math.min(searchMatches * 0.04, 0.24);
  boost += Math.min(contentMatches * 0.01, 0.05);
  boost += Math.min(chunk.metadata.priority * 0.03, 0.12);

  if (chunk.metadata.tags.includes("informacion-general")) {
    boost -= 0.12;
  }

  const normalizedUrl = chunk.metadata.url.toLowerCase();
  if (
    normalizedUrl.includes("sede.seg-social.gob.es") ||
    normalizedUrl.includes("seg-social.es") ||
    normalizedUrl.includes("importass")
  ) {
    boost += 0.12;
  }

  if (normalizedUrl.includes("revista.seg-social.es")) {
    boost -= 0.18;
  }

  if (!preparationFocused && chunk.metadata.sourceKind === "form") {
    boost += chunk.metadata.benefitId === "tse-cps" && isTseComparisonQuestion(questionTokens) ? 0.04 : -0.12;
  }

  if (!isStudyFocusedQuestion(questionTokens) && isTseStudyEdgeCaseChunk(chunk)) {
    boost -= 0.35;
  }

  boost += getIntentScoreAdjustments(questionTokens, chunk);
  boost += computeContextBoost(context, chunk);

  return boost;
}

export function expandQuestion(question: string): string {
  let expanded = question.trim();

  for (const rule of EXPANSION_RULES) {
    if (rule.pattern.test(question)) {
      expanded = `${expanded} ${rule.expansion}`;
    }
  }

  return expanded;
}

export function rerankRetrievedChunks(
  question: string,
  chunks: RetrievedChunk[],
  topK: number,
  context?: RetrievalIntentContext,
): RetrievedChunk[] {
  const questionTokens = tokenize(question);

  const ranked = [...chunks]
    .map((chunk) => ({
      ...chunk,
      rerankScore: chunk.score + computeBoost(questionTokens, chunk, context),
    }))
    .sort((left, right) => (right.rerankScore ?? right.score) - (left.rerankScore ?? left.score));

  const sanitized = filterPeripheralChunks(ranked, questionTokens, context);
  const pool = sanitized.length > 0 ? sanitized : ranked;
  const topScore = pool[0]?.rerankScore ?? pool[0]?.score ?? 0;
  const filtered = pool.filter((chunk) => (chunk.rerankScore ?? chunk.score) >= topScore - 0.07);

  return applySourceDiversity(filtered, topK, 2, pool);
}
