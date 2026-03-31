import type {
  AnswerConfidence,
  AnswerDecisionStatus,
  AnswerPayload,
  AnswerSections,
  AnswerSource,
  ChatIntent,
  ChatState,
  RecommendedAction,
} from "../types/answers.js";
import type { RetrievedChunk } from "../types/documents.js";

import { dedupeBy, normalizeWhitespace, truncateText } from "../utils/text.js";
import { benefitCatalogUrlMatches } from "./inssCatalog.js";
import { buildClarificationSummary } from "./conversation.js";

interface StructuredAnswerContent {
  summary: string;
  keyPoints: string[];
  body: string;
  sections: AnswerSections;
}

interface PayloadMeta {
  mode?: "clarify" | "answer";
  intent?: ChatIntent;
  state?: ChatState;
  clarifyingQuestions?: string[];
  recommendedActions?: RecommendedAction[];
  suggestedReplies?: string[];
}

const MAX_KEY_POINTS = 6;
const SECTION_KEY_BY_HEADING: Record<string, keyof AnswerSections | "summary"> = {
  "respuesta breve": "summary",
  "respuesta directa": "summary",
  "que preparar ahora": "documents",
  "como presentarlo": "nextStepNow",
  "que cambia la respuesta": "whatChangesTheOutcome",
  "que cambia el resultado": "whatChangesTheOutcome",
  "que puede cambiar": "whatChangesTheOutcome",
  "documentos o datos que suelen pedir": "documents",
  "documentos o datos": "documents",
  "como presentarlo o pedirlo": "nextStepNow",
  "siguiente paso ahora": "nextStepNow",
  "si lo vas a tramitar ahora": "nextStepNow",
  "siguiente paso claro": "nextStepNow",
  "si luego hay requerimiento o notificacion": "ifINSSRespondsX",
  "si el inss te responde o te pide algo": "ifINSSRespondsX",
  "plazos y avisos": "deadlinesAndWarnings",
  "ojo con esto": "deadlinesAndWarnings",
  "alternativas si esta via no encaja": "alternatives",
  "si faltan datos": "missingInfo",
  "fuentes oficiales": "summary",
  "aviso legal": "summary",
  "si hay problemas con la identificacion electronica": "warnings",
  "problemas con la identificacion": "warnings",
  "alternativa sin certificado": "alternatives",
};

function isBulletLine(line: string): boolean {
  return /^([-*]|\d+\.)\s+/.test(line);
}

function toBulletText(line: string): string {
  return line.replace(/^([-*]|\d+\.)\s+/, "").trim();
}

function createEmptySections(): AnswerSections {
  return {
    immediateSteps: [],
    documents: [],
    warnings: [],
    missingInfo: [],
    caseSummary: [],
    whatChangesTheOutcome: [],
    nextStepNow: [],
    deadlinesAndWarnings: [],
    ifINSSRespondsX: [],
    alternatives: [],
  };
}

function createDefaultIntent(): ChatIntent {
  return {
    family: "general",
    operation: "general",
    lifecycleStage: "descubrimiento",
  };
}

function createDefaultState(intent?: ChatIntent): ChatState {
  const resolvedIntent = intent ?? createDefaultIntent();

  return {
    family: resolvedIntent.family,
    operation: resolvedIntent.operation,
    benefitId: resolvedIntent.benefitId,
    lifecycleStage: resolvedIntent.lifecycleStage ?? "descubrimiento",
    facts: {},
    missingFacts: [],
    factsConfirmed: {},
    factsPending: [],
    caseSummary: "Caso abierto sin datos suficientes.",
    lastRecommendedAction: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeHeading(line: string): string {
  return line.replace(/:$/, "").trim().toLowerCase();
}

function pushSectionLine(sections: AnswerSections, sectionKey: keyof AnswerSections, value: string): void {
  sections[sectionKey].push(value);

  if (sectionKey === "nextStepNow" && sections.immediateSteps.length < 4) {
    sections.immediateSteps.push(value);
  }

  if (sectionKey === "deadlinesAndWarnings" && sections.warnings.length < 4) {
    sections.warnings.push(value);
  }
}

function extractStructuredContent(answer: string): StructuredAnswerContent {
  const body = truncateText(normalizeWhitespace(answer), 3200);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = createEmptySections();
  let summary = "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.";
  let activeSection: keyof AnswerSections | "summary" | undefined;

  for (const line of lines) {
    const normalizedHeading = normalizeHeading(line);
    const headingSection = SECTION_KEY_BY_HEADING[normalizedHeading];

    if (headingSection) {
      activeSection = headingSection;
      continue;
    }

    const value = isBulletLine(line) ? toBulletText(line) : line;

    if (activeSection && activeSection !== "summary") {
      pushSectionLine(sections, activeSection, value);
      continue;
    }

    if (summary === "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.") {
      summary = value;
    }
  }

  if (sections.nextStepNow.length === 0 && sections.immediateSteps.length > 0) {
    sections.nextStepNow = [...sections.immediateSteps];
  }

  if (sections.deadlinesAndWarnings.length === 0 && sections.warnings.length > 0) {
    sections.deadlinesAndWarnings = [...sections.warnings];
  }

  const keyPoints = dedupeBy(
    [
      ...sections.nextStepNow,
      ...sections.documents,
      ...sections.deadlinesAndWarnings,
      ...sections.whatChangesTheOutcome,
    ].filter(Boolean),
    (line) => line.toLowerCase(),
  ).slice(0, MAX_KEY_POINTS);

  return {
    summary,
    keyPoints,
    body,
    sections,
  };
}

export function formatRetrievedChunks(chunks: RetrievedChunk[], maxContextChars: number): string {
  const lines: string[] = [];
  let currentLength = 0;

  for (const [index, chunk] of chunks.entries()) {
    const block = [
      `Fuente ${index + 1}`,
      `Titulo: ${chunk.metadata.title}`,
      `URL: ${chunk.metadata.url}`,
      `Prestacion: ${chunk.metadata.benefitId ?? "sin catalogar"}`,
      `Etapa: ${chunk.metadata.lifecycle ?? "sin etapa"}`,
      `Contenido: ${normalizeWhitespace(chunk.pageContent)}`,
    ].join("\n");

    if (currentLength + block.length > maxContextChars) {
      break;
    }

    lines.push(block);
    currentLength += block.length;
  }

  return lines.join("\n\n");
}

export function buildLegalNotice(): string {
  return "Aviso legal: esta respuesta es informativa y no sustituye la informacion oficial publicada por la Seguridad Social ni el asesoramiento juridico profesional.";
}

function getSourceSelectionScore(chunk: RetrievedChunk, intent?: ChatIntent): number {
  let score = chunk.rerankScore ?? chunk.score;

  if (!intent?.benefitId) {
    return score;
  }

  if (
    chunk.metadata.benefitId === intent.benefitId ||
    benefitCatalogUrlMatches(intent.benefitId, chunk.metadata.url)
  ) {
    score += 1;
  } else if (chunk.metadata.benefitId && chunk.metadata.benefitId !== intent.benefitId) {
    score -= 0.6;
  }

  return score;
}

export function getAnswerSources(chunks: RetrievedChunk[], intent?: ChatIntent): AnswerSource[] {
  const uniqueChunks = dedupeBy(chunks, (chunk) => chunk.metadata.url).sort(
    (left, right) => getSourceSelectionScore(right, intent) - getSourceSelectionScore(left, intent),
  );

  const preferredChunks = intent?.benefitId
    ? uniqueChunks.filter(
        (chunk) =>
          chunk.metadata.benefitId === intent.benefitId || benefitCatalogUrlMatches(intent.benefitId, chunk.metadata.url),
      )
    : uniqueChunks;

  const sourcePool = preferredChunks.length >= 2 ? preferredChunks : uniqueChunks;

  return sourcePool
    .slice(0, 3)
    .map((chunk) => ({
      title: chunk.metadata.title,
      url: chunk.metadata.url,
    }));
}

export function buildSourcesSection(sources: AnswerSource[], includeUrls = true): string {
  if (sources.length === 0) {
    return "";
  }

  return [
    "Fuentes oficiales:",
    ...sources.map((source, index) =>
      includeUrls ? `${index + 1}. ${source.title} - ${source.url}` : `${index + 1}. ${source.title}`,
    ),
  ].join("\n");
}

function resolvePayloadMeta(meta?: PayloadMeta): Required<PayloadMeta> {
  const intent = meta?.intent ?? createDefaultIntent();
  const recommendedActions = meta?.recommendedActions ?? [];
  const suggestedReplies =
    meta?.suggestedReplies ?? (recommendedActions.length > 0 ? recommendedActions.map((action) => action.prompt) : []);

  return {
    mode: meta?.mode ?? "answer",
    intent,
    state: meta?.state ?? createDefaultState(intent),
    clarifyingQuestions: meta?.clarifyingQuestions ?? [],
    recommendedActions,
    suggestedReplies,
  };
}

function inferDecisionStatus(mode: "clarify" | "answer", intent: ChatIntent): AnswerDecisionStatus {
  if (mode === "clarify") {
    return "need_info";
  }

  if (["seguimiento", "resolucion", "revision"].includes(intent.lifecycleStage ?? "")) {
    return "follow_up";
  }

  if (intent.lifecycleStage === "presentacion" || intent.operation === "solicitud") {
    return "ready_to_submit";
  }

  return "ready_to_prepare";
}

function inferConfidence(
  mode: "clarify" | "answer",
  sources: AnswerSource[],
  sections: AnswerSections,
  summary: string,
): AnswerConfidence {
  if (mode === "clarify") {
    return "medium";
  }

  if (summary.toLowerCase().includes("no tengo contexto oficial suficiente")) {
    return "low";
  }

  if (sources.length >= 2 && (sections.nextStepNow.length > 0 || sections.documents.length > 0)) {
    return "high";
  }

  return sources.length > 0 ? "medium" : "low";
}

function buildChecklist(sections: AnswerSections, fallback: string[] = []): string[] {
  const checklist = dedupeBy(
    [...sections.nextStepNow, ...sections.documents, ...sections.ifINSSRespondsX].filter(Boolean),
    (line) => line.toLowerCase(),
  );

  return checklist.length > 0 ? checklist.slice(0, 6) : fallback.slice(0, 6);
}

function resolveStateWithNextAction(state: ChatState, nextBestAction: string, caseSummary: string): ChatState {
  return {
    ...state,
    caseSummary: state.caseSummary || caseSummary,
    lastRecommendedAction: nextBestAction,
    updatedAt: new Date().toISOString(),
  };
}

export function buildClarificationPayload(meta: PayloadMeta & { state: ChatState }): AnswerPayload {
  const resolvedMeta = resolvePayloadMeta({
    ...meta,
    mode: "clarify",
  });
  const legalNotice = buildLegalNotice();
  const sections = createEmptySections();
  sections.missingInfo = resolvedMeta.state.missingFacts;
  sections.caseSummary = [resolvedMeta.state.caseSummary];

  const nextBestAction = "Responder a las preguntas cortas para poder orientar el caso con criterio.";
  const state = resolveStateWithNextAction(resolvedMeta.state, nextBestAction, resolvedMeta.state.caseSummary);
  const summary = buildClarificationSummary(state);
  const checklist = buildChecklist(sections, resolvedMeta.clarifyingQuestions);
  const text = [
    "Respuesta breve:",
    summary,
    "",
    "Que preparar ahora:",
    "- Reunir el dato que falta antes de presentar o decidir el siguiente paso.",
    "",
    "Como presentarlo:",
    `- ${nextBestAction}`,
    "",
    "Que puede cambiar:",
    ...resolvedMeta.clarifyingQuestions.map((question) => `- ${question}`),
    "",
    "Si luego hay requerimiento o notificacion:",
    "- Cuando ese dato quede claro, ya podre ordenar la via oficial y la documentacion de forma segura.",
    "",
    legalNotice,
  ].join("\n");
  const decisionStatus = inferDecisionStatus("clarify", resolvedMeta.intent);
  const confidence = inferConfidence("clarify", [], sections, summary);

  return {
    mode: "clarify",
    decisionStatus,
    confidence,
    intent: resolvedMeta.intent,
    benefitId: resolvedMeta.intent.benefitId,
    lifecycleStage: resolvedMeta.intent.lifecycleStage,
    text,
    sources: [],
    summary,
    keyPoints: state.missingFacts,
    caseSummary: state.caseSummary,
    checklist,
    alternatives: [],
    nextBestAction,
    legalNotice,
    sections,
    clarifyingQuestions: resolvedMeta.clarifyingQuestions,
    recommendedActions: resolvedMeta.recommendedActions,
    suggestedReplies: resolvedMeta.suggestedReplies,
    state,
  };
}

export function composeAnswerPayload(answer: string, chunks: RetrievedChunk[], meta?: PayloadMeta): AnswerPayload {
  const structured = extractStructuredContent(answer);
  const legalNotice = buildLegalNotice();
  const resolvedMeta = resolvePayloadMeta(meta);
  const sources = getAnswerSources(chunks, resolvedMeta.intent);
  const caseSummary =
    structured.sections.caseSummary[0] ??
    resolvedMeta.state.caseSummary ??
    resolvedMeta.intent.benefitId ??
    structured.summary;
  const nextBestAction =
    structured.sections.nextStepNow[0] ??
    structured.sections.immediateSteps[0] ??
    resolvedMeta.state.lastRecommendedAction ??
    "Revisa una fuente oficial antes de presentar el tramite.";
  const checklist = buildChecklist(structured.sections, structured.keyPoints);
  const state = resolveStateWithNextAction(resolvedMeta.state, nextBestAction, caseSummary);
  const decisionStatus = inferDecisionStatus(resolvedMeta.mode, resolvedMeta.intent);
  const confidence = inferConfidence(resolvedMeta.mode, sources, structured.sections, structured.summary);

  return {
    mode: resolvedMeta.mode,
    decisionStatus,
    confidence,
    intent: resolvedMeta.intent,
    benefitId: resolvedMeta.intent.benefitId,
    lifecycleStage: resolvedMeta.intent.lifecycleStage,
    text: [structured.body, buildSourcesSection(sources, false), legalNotice].filter(Boolean).join("\n\n"),
    sources,
    summary: structured.summary,
    keyPoints: structured.keyPoints.length > 0 ? structured.keyPoints : checklist,
    caseSummary,
    checklist,
    alternatives: structured.sections.alternatives,
    nextBestAction,
    legalNotice,
    sections: structured.sections,
    clarifyingQuestions: resolvedMeta.clarifyingQuestions,
    recommendedActions: resolvedMeta.recommendedActions,
    suggestedReplies: resolvedMeta.suggestedReplies,
    state,
  };
}

export function composeStandaloneAnswerPayload(answer: string, sources: AnswerSource[] = [], meta?: PayloadMeta): AnswerPayload {
  const structured = extractStructuredContent(answer);
  const legalNotice = buildLegalNotice();
  const resolvedMeta = resolvePayloadMeta(meta);
  const caseSummary =
    structured.sections.caseSummary[0] ??
    resolvedMeta.state.caseSummary ??
    resolvedMeta.intent.benefitId ??
    structured.summary;
  const nextBestAction =
    structured.sections.nextStepNow[0] ??
    structured.sections.immediateSteps[0] ??
    resolvedMeta.state.lastRecommendedAction ??
    "Revisa una fuente oficial antes de presentar el tramite.";
  const checklist = buildChecklist(structured.sections, structured.keyPoints);
  const state = resolveStateWithNextAction(resolvedMeta.state, nextBestAction, caseSummary);
  const decisionStatus = inferDecisionStatus(resolvedMeta.mode, resolvedMeta.intent);
  const confidence = inferConfidence(resolvedMeta.mode, sources, structured.sections, structured.summary);

  return {
    mode: resolvedMeta.mode,
    decisionStatus,
    confidence,
    intent: resolvedMeta.intent,
    benefitId: resolvedMeta.intent.benefitId,
    lifecycleStage: resolvedMeta.intent.lifecycleStage,
    text: [structured.body, buildSourcesSection(sources, false), legalNotice].filter(Boolean).join("\n\n"),
    sources,
    summary: structured.summary,
    keyPoints: structured.keyPoints.length > 0 ? structured.keyPoints : checklist,
    caseSummary,
    checklist,
    alternatives: structured.sections.alternatives,
    nextBestAction,
    legalNotice,
    sections: structured.sections,
    clarifyingQuestions: resolvedMeta.clarifyingQuestions,
    recommendedActions: resolvedMeta.recommendedActions,
    suggestedReplies: resolvedMeta.suggestedReplies,
    state,
  };
}

export function composeCliAnswer(answer: string, chunks: RetrievedChunk[]): string {
  const structured = extractStructuredContent(answer);
  const sources = getAnswerSources(chunks);

  return [structured.body, buildSourcesSection(sources, true), buildLegalNotice()].filter(Boolean).join("\n\n");
}

export function buildNoContextAnswer(): string {
  return [
    "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.",
    "",
    "Consulta la web oficial o la sede electronica de la Seguridad Social para confirmarlo antes de presentar nada.",
    "",
    buildLegalNotice(),
  ].join("\n");
}

export function buildNoContextAnswerPayload(meta?: PayloadMeta): AnswerPayload {
  const text = buildNoContextAnswer();
  const sections = createEmptySections();
  sections.missingInfo = ["No hay contexto oficial suficiente para responder con seguridad a esta consulta."];
  const resolvedMeta = resolvePayloadMeta(meta);
  const caseSummary = resolvedMeta.state.caseSummary;
  const nextBestAction = "Abre una fuente oficial del INSS antes de decidir el siguiente paso.";
  const state = resolveStateWithNextAction(resolvedMeta.state, nextBestAction, caseSummary);
  const decisionStatus: AnswerDecisionStatus = "need_info";
  const confidence = inferConfidence(resolvedMeta.mode, [], sections, "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.");

  return {
    mode: resolvedMeta.mode,
    decisionStatus,
    confidence,
    intent: resolvedMeta.intent,
    benefitId: resolvedMeta.intent.benefitId,
    lifecycleStage: resolvedMeta.intent.lifecycleStage,
    text,
    sources: [],
    summary: "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.",
    keyPoints: [],
    caseSummary,
    checklist: [],
    alternatives: [],
    nextBestAction,
    legalNotice: buildLegalNotice(),
    sections,
    clarifyingQuestions: resolvedMeta.clarifyingQuestions,
    recommendedActions: resolvedMeta.recommendedActions,
    suggestedReplies: resolvedMeta.suggestedReplies,
    state,
  };
}
