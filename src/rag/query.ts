import type { RetrievedChunk } from "../types/documents.js";
import { countTokenMatches, tokenizeSearchText } from "../utils/text.js";

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
    pattern: /\bnuss\b|\bnaf\b|numero de la seguridad social|n[úu]mero de la seguridad social/i,
    expansion: "solicitar numero de la seguridad social acreditacion nuss naf afiliacion importass",
  },
  {
    pattern: /\bautonom/i,
    expansion: "alta en trabajo autonomo baja en trabajo autonomo reta actividad economica importass",
  },
  {
    pattern: /\bjubil/i,
    expansion: "pension de jubilacion procedimiento solicitud requisitos documentacion edad retiro",
  },
  {
    pattern: /\bedad de jubilacion\b|edad de jubilaci[oó]n|jubilarme a los|cuando me puedo jubilar|cu[aá]ndo me puedo jubilar/i,
    expansion: "jubilacion ordinaria requisitos edad periodo minimo de cotizacion acceso pension",
  },
  {
    pattern: /\bsimular\b|\bsimulador\b|calcular mi jubilacion|calcular mi pensi[oó]n/i,
    expansion: "simulador de jubilacion tu seguridad social sms calculo pension futura",
  },
  {
    pattern: /\bincapacidad temporal\b|baja medica|baja m[eé]dica/i,
    expansion: "prestacion de incapacidad temporal subsidio baja medica enfermedad accidente procedimiento",
  },
  {
    pattern: /\bincapacidad permanente\b|invalidez/i,
    expansion: "incapacidad permanente concepto grados invalidez pension trabajador",
  },
  {
    pattern: /\bincapacidad permanente parcial\b|\bparcial\b/i,
    expansion: "incapacidad permanente parcial indemnizacion prestacion lesiones permanentes",
  },
  {
    pattern: /\bincapacidad permanente absoluta\b|\babsoluta\b/i,
    expansion: "incapacidad permanente absoluta pension trabajo profesion habitual",
  },
  {
    pattern: /\bgran incapacidad\b/i,
    expansion: "gran incapacidad complemento tercera persona pension incapacidad permanente",
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
    pattern: /\bviudedad\b/i,
    expansion: "pension de viudedad beneficiarios requisitos causantes muerte supervivencia solicitud",
  },
  {
    pattern: /\borfandad\b/i,
    expansion: "pension de orfandad beneficiarios requisitos muerte supervivencia",
  },
  {
    pattern: /\bimv\b|ingreso m[ií]nimo vital|ingreso minimo vital/i,
    expansion: "ingreso minimo vital solicitud documentacion portal prestaciones seguridad social",
  },
  {
    pattern: /\btse\b|tarjeta sanitaria europea/i,
    expansion: "tarjeta sanitaria europea tse solicitud renovacion asistencia sanitaria estancia temporal",
  },
  {
    pattern: /\bcita previa\b|pedir cita|solicitar cita/i,
    expansion: "cita previa seguridad social pensiones prestaciones inss canales de atencion",
  },
  {
    pattern: /\bsin certificado\b|sin clave|sin cl@ve|via sms|v[ií]a sms/i,
    expansion: "tramites sin certificado digital ni clave presentacion telematica via sms inss seguridad social",
  },
  {
    pattern: /\bdocumentacion\b|documentaci[oó]n|papeles|documentos/i,
    expansion: "documentacion solicitud requisitos justificantes formulario tramite",
  },
  {
    pattern: /\bcuantia\b|cuant[ií]a|importe|cuanto cobro|cu[aá]nto cobro/i,
    expansion: "cuantia importe porcentaje base reguladora abono pension prestacion",
  },
];

function tokenize(input: string): string[] {
  return tokenizeSearchText(input, {
    stopwords: SPANISH_STOPWORDS,
  });
}

function computeBoost(questionTokens: string[], chunk: RetrievedChunk): number {
  const titleMatches = countTokenMatches(questionTokens, chunk.metadata.title);
  const tagMatches = countTokenMatches(questionTokens, chunk.metadata.tags.join(" "));
  const contentMatches = countTokenMatches(questionTokens, chunk.pageContent.slice(0, 500));

  let boost = 0;
  boost += Math.min(titleMatches * 0.05, 0.2);
  boost += Math.min(tagMatches * 0.08, 0.24);
  boost += Math.min(contentMatches * 0.01, 0.05);
  boost += Math.min(chunk.metadata.priority * 0.03, 0.12);

  if (chunk.metadata.tags.includes("informacion-general")) {
    boost -= 0.12;
  }

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

export function rerankRetrievedChunks(question: string, chunks: RetrievedChunk[], topK: number): RetrievedChunk[] {
  const questionTokens = tokenize(question);

  const ranked = [...chunks]
    .map((chunk) => ({
      ...chunk,
      rerankScore: chunk.score + computeBoost(questionTokens, chunk),
    }))
    .sort((left, right) => (right.rerankScore ?? right.score) - (left.rerankScore ?? left.score));

  const topScore = ranked[0]?.rerankScore ?? ranked[0]?.score ?? 0;
  const filtered = ranked.filter((chunk) => (chunk.rerankScore ?? chunk.score) >= topScore - 0.07);

  return filtered.slice(0, topK);
}
