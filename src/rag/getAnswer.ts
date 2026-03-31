import type { AnswerPayload, ChatChannel, ChatState } from "../types/answers.js";

import { assertRuntimeConfig, getEnv, getRequiredBotMode } from "../config/env.js";
import { normalizeSearchText, tokenizeSearchText } from "../utils/text.js";
import { answerQuestion } from "./answerQuestion.js";
import { answerWithLlm } from "./answerWithLlm.js";

export interface GetAnswerOptions {
  channel?: ChatChannel;
  state?: ChatState;
}

function isGreeting(question: string): boolean {
  const normalized = normalizeSearchText(question);
  const tokens = tokenizeSearchText(question);

  if (tokens.length > 6) {
    return false;
  }

  return /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos|ey|hi|hello)\b/i.test(normalized);
}

interface OutOfScopeMatch {
  text: string;
  suggestedReplies: string[];
}

function detectOutOfScope(question: string): OutOfScopeMatch | undefined {
  const normalized = normalizeSearchText(question);

  if (/\b(paro|desempleo|sepe|despido|me han echado|inem)\b/i.test(normalized) && !/\bincapacidad\b/i.test(normalized)) {
    return {
      text: [
        "Las prestaciones por desempleo (paro) las gestiona el SEPE, no el INSS.",
        "",
        "Tu siguiente paso es consultar la sede electronica del SEPE: sede.sepe.gob.es",
        "Tambien puedes llamar al 900 81 24 00 (telefono gratuito del SEPE).",
        "",
        "Si lo que necesitas es un tema de Seguridad Social (jubilacion, baja medica, prestaciones), preguntame y te oriento.",
      ].join("\n"),
      suggestedReplies: [
        "Cuando me puedo jubilar?",
        "Necesito la baja medica, que hago?",
        "Como pido el Ingreso Minimo Vital?",
      ],
    };
  }

  if (/\b(irpf|renta|hacienda|agencia tributaria|declaracion de la renta|impuestos)\b/i.test(normalized)) {
    return {
      text: [
        "Los temas de impuestos y declaracion de la renta los gestiona la Agencia Tributaria, no el INSS.",
        "",
        "Tu siguiente paso es consultar agenciatributaria.es o llamar al 901 33 55 33.",
        "",
        "Si necesitas algo de Seguridad Social, aqui estoy para ayudarte.",
      ].join("\n"),
      suggestedReplies: [
        "Cuando me puedo jubilar?",
        "Como pido el Ingreso Minimo Vital?",
        "Que documentos necesito para una prestacion?",
      ],
    };
  }

  if (/\b(cita (con el |con mi )?medico|centro de salud|medico de cabecera|urgencias|hospital)\b/i.test(normalized) && !/\bbaja medica\b/i.test(normalized)) {
    return {
      text: [
        "Las citas medicas y la atencion sanitaria dependen de tu comunidad autonoma, no del INSS.",
        "",
        "Busca \"cita previa salud + [tu comunidad autonoma]\" para encontrar tu servicio regional de salud.",
        "",
        "Si lo que necesitas es la Tarjeta Sanitaria Europea o una baja medica, eso si puedo ayudarte.",
      ].join("\n"),
      suggestedReplies: [
        "Necesito la Tarjeta Sanitaria Europea",
        "Estoy de baja medica, que hago?",
        "Como doy de alta a un beneficiario en sanidad?",
      ],
    };
  }

  if (/\b(frustra|no me sirve|no me ayuda|no entiendo nada|necesito hablar con alguien|esto es inutil)\b/i.test(normalized)) {
    return {
      text: [
        "Entiendo que puede ser frustrante. Si prefieres hablar con una persona, tienes estas opciones:",
        "",
        "- Telefono del INSS: 900 166 565 (gratuito, lunes a viernes de 9:00 a 14:00)",
        "- Cita previa en tu CAISS: sede.seg-social.gob.es (seccion Cita previa)",
        "",
        "Si quieres seguir intentandolo aqui, explicame tu situacion con una frase sencilla e intento orientarte mejor.",
      ].join("\n"),
      suggestedReplies: [
        "Cuando me puedo jubilar?",
        "Necesito la baja medica, que hago?",
        "Como veo el estado de mi expediente?",
      ],
    };
  }

  return undefined;
}

function buildGreetingPayload(): AnswerPayload {
  const suggestedReplies = [
    "Cuando me puedo jubilar?",
    "Necesito la baja medica, que hago?",
    "Como pido el Ingreso Minimo Vital?",
    "Quiero la Tarjeta Sanitaria Europea",
    "Como veo el estado de mi expediente?",
  ];

  return {
    mode: "answer",
    decisionStatus: "need_info",
    confidence: "high",
    intent: { family: "general", operation: "general", lifecycleStage: "descubrimiento" },
    lifecycleStage: "descubrimiento",
    text: "Hola! Estoy aqui para ayudarte con temas de Seguridad Social. Puedes preguntarme sobre jubilacion, bajas medicas, prestaciones, tramites... lo que necesites.\n\nElige una de las preguntas frecuentes o escribe tu duda con tus palabras.",
    sources: [],
    summary: "Hola! Preguntame lo que necesites sobre Seguridad Social.",
    keyPoints: [],
    caseSummary: "Caso abierto sin datos suficientes.",
    checklist: [],
    alternatives: [],
    nextBestAction: "",
    legalNotice: "",
    sections: {
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
    },
    clarifyingQuestions: [],
    recommendedActions: suggestedReplies.map((prompt, index) => ({
      id: `faq-${index}`,
      label: prompt,
      prompt,
    })),
    suggestedReplies,
    state: {
      family: "general",
      operation: "general",
      lifecycleStage: "descubrimiento",
      facts: {},
      missingFacts: [],
      factsConfirmed: {},
      factsPending: [],
      caseSummary: "Caso abierto sin datos suficientes.",
      lastRecommendedAction: "",
      updatedAt: new Date().toISOString(),
    },
  };
}

function buildOutOfScopePayload(match: OutOfScopeMatch): AnswerPayload {
  return {
    mode: "answer",
    decisionStatus: "follow_up",
    confidence: "high",
    intent: { family: "general", operation: "general", lifecycleStage: "descubrimiento" },
    lifecycleStage: "descubrimiento",
    text: match.text,
    sources: [],
    summary: match.text.split("\n")[0],
    keyPoints: [],
    caseSummary: "Caso abierto sin datos suficientes.",
    checklist: [],
    alternatives: [],
    nextBestAction: "",
    legalNotice: "",
    sections: {
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
    },
    clarifyingQuestions: [],
    recommendedActions: match.suggestedReplies.map((prompt, index) => ({
      id: `oos-${index}`,
      label: prompt,
      prompt,
    })),
    suggestedReplies: match.suggestedReplies,
    state: {
      family: "general",
      operation: "general",
      lifecycleStage: "descubrimiento",
      facts: {},
      missingFacts: [],
      factsConfirmed: {},
      factsPending: [],
      caseSummary: "Caso abierto sin datos suficientes.",
      lastRecommendedAction: "",
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function getAnswer(question: string, options?: GetAnswerOptions): Promise<AnswerPayload> {
  const env = getEnv();
  assertRuntimeConfig(env, "chat");
  const botMode = getRequiredBotMode(env);

  if (isGreeting(question)) {
    return buildGreetingPayload();
  }

  const outOfScope = detectOutOfScope(question);
  if (outOfScope) {
    return buildOutOfScopePayload(outOfScope);
  }

  if (botMode === "echo") {
    return {
      mode: "answer",
      decisionStatus: "follow_up",
      confidence: "low",
      intent: {
        family: "general",
        operation: "general",
        lifecycleStage: "descubrimiento",
      },
      lifecycleStage: "descubrimiento",
      text: `Eco: ${question}`,
      sources: [],
      summary: `Eco: ${question}`,
      keyPoints: [],
      caseSummary: "Caso abierto sin datos suficientes.",
      checklist: [],
      alternatives: [],
      nextBestAction: "",
      legalNotice: "",
      sections: {
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
      },
      clarifyingQuestions: [],
      recommendedActions: [],
      suggestedReplies: [],
      state: {
        family: "general",
        operation: "general",
        lifecycleStage: "descubrimiento",
        facts: {},
        missingFacts: [],
        factsConfirmed: {},
        factsPending: [],
        caseSummary: "Caso abierto sin datos suficientes.",
        lastRecommendedAction: "",
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (botMode === "llm") {
    return answerWithLlm(question, options?.state);
  }

  return answerQuestion(question, options?.state);
}
