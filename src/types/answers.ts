export interface AnswerSource {
  title: string;
  url: string;
}

export type ChatChannel = "web" | "telegram";
export type AnswerDecisionStatus = "need_info" | "ready_to_prepare" | "ready_to_submit" | "follow_up";
export type AnswerConfidence = "low" | "medium" | "high";

export type IntentFamily =
  | "general"
  | "jubilacion"
  | "incapacidad"
  | "familia-cuidados"
  | "supervivencia"
  | "asistencia-sanitaria"
  | "imv"
  | "operativa-inss"
  | "prestaciones-especiales";

export type IntentOperation =
  | "general"
  | "requisitos"
  | "documentacion"
  | "solicitud"
  | "rellenado-formulario"
  | "estado-expediente"
  | "subsanacion-requerimiento"
  | "notificacion"
  | "cita-caiss"
  | "sin-certificado-sms"
  | "cuantia"
  | "plazos"
  | "compatibilidades"
  | "pago-cobro"
  | "revision"
  | "reclamacion-previa"
  | "silencio-administrativo"
  | "variacion-datos"
  | "suspension-extincion";

export type LifecycleStage =
  | "descubrimiento"
  | "orientacion"
  | "preparacion"
  | "presentacion"
  | "seguimiento"
  | "resolucion"
  | "revision";

export interface AnswerSections {
  immediateSteps: string[];
  documents: string[];
  warnings: string[];
  missingInfo: string[];
  caseSummary: string[];
  whatChangesTheOutcome: string[];
  nextStepNow: string[];
  deadlinesAndWarnings: string[];
  ifINSSRespondsX: string[];
  alternatives: string[];
}

export interface RecommendedAction {
  id: string;
  label: string;
  prompt: string;
}

export interface ChatIntent {
  family: IntentFamily;
  operation: IntentOperation;
  benefitId?: string;
  lifecycleStage?: LifecycleStage;
}

export interface ChatState {
  family: IntentFamily;
  operation: IntentOperation;
  benefitId?: string;
  lifecycleStage: LifecycleStage;
  facts: Record<string, string>;
  missingFacts: string[];
  factsConfirmed: Record<string, string>;
  factsPending: string[];
  caseSummary: string;
  lastRecommendedAction: string;
  updatedAt: string;
}

export interface AnswerPayload {
  mode: "clarify" | "answer";
  decisionStatus: AnswerDecisionStatus;
  confidence: AnswerConfidence;
  intent: ChatIntent;
  benefitId?: string;
  lifecycleStage?: LifecycleStage;
  text: string;
  sources: AnswerSource[];
  summary: string;
  keyPoints: string[];
  caseSummary: string;
  checklist: string[];
  alternatives: string[];
  nextBestAction: string;
  legalNotice: string;
  sections: AnswerSections;
  clarifyingQuestions: string[];
  recommendedActions: RecommendedAction[];
  suggestedReplies: string[];
  state: ChatState;
}
