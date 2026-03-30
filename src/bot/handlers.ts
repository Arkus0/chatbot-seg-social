import type { Context, Telegraf } from "telegraf";
import { Markup } from "telegraf";

import { getAnswer } from "../rag/getAnswer.js";
import { isTelegramStateExpired } from "../rag/conversation.js";
import { buildGuidedPrompt, getGuidedProcedureLibrary } from "../rag/inssCatalog.js";
import type { AnswerPayload, AnswerSource, ChatState } from "../types/answers.js";
import { logger } from "../utils/logger.js";
import { splitTelegramMessage } from "../utils/text.js";

type MenuTopic = {
  id: string;
  label: string;
  prompt: string;
};

type ChatMode = "free" | "guided";

type ChatSession = {
  mode: ChatMode;
  topicId?: string;
  state?: ChatState;
  suggestedReplies: string[];
  updatedAt: number;
};

const CHAT_STATE_TTL_MS = 30 * 60 * 1000;
const chatSessions = new Map<number, ChatSession>();

const MENU_TOPICS: MenuTopic[] = getGuidedProcedureLibrary().map((entry) => ({
  id: entry.id,
  label: entry.shortLabel,
  prompt: entry.exampleQuestion,
}));

const MENU_TOPIC_BY_ID = new Map(MENU_TOPICS.map((topic) => [topic.id, topic]));

function buildSourceButtonLabel(source: AnswerSource, index: number): string {
  const compactTitle = source.title.replace(/\s+/g, " ").trim();
  const clippedTitle = compactTitle.length > 42 ? `${compactTitle.slice(0, 39).trimEnd()}...` : compactTitle;
  return `${index + 1}. ${clippedTitle}`;
}

function buildSourceKeyboard(sources: AnswerSource[]) {
  const rows = sources.map((source, index) => [Markup.button.url(buildSourceButtonLabel(source, index), source.url)]);
  return Markup.inlineKeyboard(rows);
}

function buildMainMenuKeyboard() {
  const topicRows = MENU_TOPICS.map((topic) => [Markup.button.callback(topic.label, `menu:topic:${topic.id}`)]);
  const utilityRows = [[Markup.button.callback("Salir del menu", "menu:exit")]];
  return Markup.inlineKeyboard([...topicRows, ...utilityRows]);
}

function buildTopicKeyboard(topicId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Ver requisitos", `menu:topic:${topicId}:requisitos`)],
    [Markup.button.callback("Ver documentacion", `menu:topic:${topicId}:documentacion`)],
    [Markup.button.callback("Como solicitar", `menu:topic:${topicId}:solicitud`)],
    [Markup.button.callback("Seguir expediente", `menu:topic:${topicId}:seguimiento`)],
    [Markup.button.callback("Resolucion o reclamacion", `menu:topic:${topicId}:resolucion`)],
    [Markup.button.callback("Volver al menu", "menu:home")],
    [Markup.button.callback("Salir", "menu:exit")],
  ]);
}

function buildSuggestedReplyKeyboard(suggestions: string[]) {
  const limitedSuggestions = suggestions.slice(0, 4);
  const rows = [];

  for (let index = 0; index < limitedSuggestions.length; index += 2) {
    const row = limitedSuggestions
      .slice(index, index + 2)
      .map((_, offset) => Markup.button.callback(limitedSuggestions[index + offset]!, `reply:${index + offset}`));
    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

function createEmptySession(mode: ChatMode = "free", topicId?: string): ChatSession {
  return {
    mode,
    topicId,
    state: undefined,
    suggestedReplies: [],
    updatedAt: Date.now(),
  };
}

function getChatSession(chatId: number): ChatSession {
  const existing = chatSessions.get(chatId);

  if (!existing) {
    const emptySession = createEmptySession();
    chatSessions.set(chatId, emptySession);
    return emptySession;
  }

  const expired =
    existing.updatedAt + CHAT_STATE_TTL_MS < Date.now() || isTelegramStateExpired(existing.state, CHAT_STATE_TTL_MS);

  if (expired) {
    const resetSession = createEmptySession(existing.mode, existing.topicId);
    chatSessions.set(chatId, resetSession);
    return resetSession;
  }

  return existing;
}

function updateChatSession(chatId: number, patch: Partial<ChatSession>): ChatSession {
  const currentSession = getChatSession(chatId);
  const nextSession: ChatSession = {
    ...currentSession,
    ...patch,
    updatedAt: Date.now(),
  };

  chatSessions.set(chatId, nextSession);
  return nextSession;
}

function setGuidedState(chatId: number, topicId?: string): void {
  updateChatSession(chatId, {
    mode: "guided",
    topicId,
    state: undefined,
    suggestedReplies: [],
  });
}

function resetChatState(chatId: number): void {
  chatSessions.set(chatId, createEmptySession());
}

function resolveChatId(ctx: Context): number | null {
  if (ctx.chat?.id) {
    return ctx.chat.id;
  }

  const callbackMessageChatId = ctx.callbackQuery && "message" in ctx.callbackQuery ? ctx.callbackQuery.message?.chat.id : null;
  return callbackMessageChatId ?? null;
}

async function replyWithAnswer(ctx: Context, answer: AnswerPayload, chatId: number): Promise<void> {
  updateChatSession(chatId, {
    state: answer.state,
    suggestedReplies: answer.suggestedReplies,
  });

  for (const chunk of splitTelegramMessage(answer.text)) {
    await ctx.reply(chunk);
  }

  if (answer.sources.length > 0) {
    await ctx.reply("Abrir fuentes oficiales:", buildSourceKeyboard(answer.sources));
  }

  if (answer.suggestedReplies.length > 0) {
    const helperText =
      answer.mode === "clarify"
        ? "Para afinar el caso, responde con una opcion o escribelo con tus palabras:"
        : "Si quieres seguir, puedes tocar una de estas opciones:";
    await ctx.reply(helperText, buildSuggestedReplyKeyboard(answer.suggestedReplies));
  }
}

async function processUserQuestion(ctx: Context, chatId: number, question: string): Promise<void> {
  const session = getChatSession(chatId);
  await ctx.sendChatAction("typing");
  const answer = await getAnswer(question, {
    channel: "telegram",
    state: session.state,
  });
  await replyWithAnswer(ctx, answer, chatId);
}

export function registerHandlers(bot: Telegraf): void {
  bot.start(async (ctx) => {
    resetChatState(ctx.chat.id);
    await ctx.reply(
      [
        "Hola. Soy un asistente informativo sobre la Seguridad Social espanola centrado en tramites INSS.",
        "",
        "Puedo ayudarte con requisitos, documentos, solicitudes, formularios, seguimiento de expediente y requerimientos usando informacion oficial.",
        "Si faltan datos del caso, te hare preguntas cortas para afinar la orientacion.",
        "",
        "Importante: no sustituyo la informacion oficial ni el asesoramiento juridico personalizado.",
      ].join("\n"),
    );

    await ctx.reply(
      "Si quieres, puedes usar el menu guiado para entrar por la familia INSS que mas se parece a tu caso.",
      buildMainMenuKeyboard(),
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "Enviame una pregunta en lenguaje natural.",
        "",
        "Ejemplos:",
        "- Tengo un requerimiento del INSS sobre jubilacion, que debo revisar",
        "- Que documentos suelen pedir para una incapacidad permanente",
        "- Como se solicita el IMV y como miro el estado del expediente",
        "- Necesito TSE o CPS para viajar, que via me conviene",
        "",
        "Tambien puedes usar /menu para navegar por familias INSS o /reset para borrar el contexto del chat.",
      ].join("\n"),
    );
  });

  bot.command("menu", async (ctx) => {
    setGuidedState(ctx.chat.id);
    await ctx.reply("Elige la familia INSS que mejor encaja con tu consulta:", buildMainMenuKeyboard());
  });

  bot.command("reset", async (ctx) => {
    resetChatState(ctx.chat.id);
    await ctx.reply("He borrado el contexto del chat. Ya puedes empezar otra consulta desde cero.");
  });

  bot.action("menu:home", async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    await ctx.answerCbQuery();
    setGuidedState(chatId);
    await ctx.reply("Volvemos al menu principal:", buildMainMenuKeyboard());
  });

  bot.action("menu:exit", async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    await ctx.answerCbQuery();
    resetChatState(chatId);
    await ctx.reply("He salido del modo guiado y he limpiado el contexto. Cuando quieras, seguimos.");
  });

  bot.action(/^menu:topic:([^:]+):(requisitos|documentacion|solicitud|seguimiento|resolucion)$/i, async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    const topicId = ctx.match[1];
    const action = ctx.match[2] as "requisitos" | "documentacion" | "solicitud" | "seguimiento" | "resolucion";
    const topic = MENU_TOPIC_BY_ID.get(topicId);

    if (!topic) {
      await ctx.answerCbQuery("Tema no disponible");
      return;
    }

    await ctx.answerCbQuery();
    setGuidedState(chatId, topic.id);

    try {
      await processUserQuestion(ctx, chatId, buildGuidedPrompt(topic.id, action));
      await ctx.reply("Puedes seguir navegando por esta familia:", buildTopicKeyboard(topic.id));
    } catch (error) {
      logger.error("Failed to answer guided topic action", {
        error,
        topicId: topic.id,
        action,
        chatId,
      });
      await ctx.reply("Ahora no puedo ampliar ese punto. Intentalo de nuevo o usa /menu.");
    }
  });

  bot.action(/^menu:topic:([^:]+)$/i, async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    const topicId = ctx.match[1];
    const topic = MENU_TOPIC_BY_ID.get(topicId);

    if (!topic) {
      await ctx.answerCbQuery("Tema no disponible");
      return;
    }

    await ctx.answerCbQuery();
    setGuidedState(chatId, topic.id);

    try {
      await processUserQuestion(ctx, chatId, topic.prompt);
      await ctx.reply("Puedes profundizar con estos botones:", buildTopicKeyboard(topic.id));
    } catch (error) {
      logger.error("Failed to answer guided topic", {
        error,
        topicId: topic.id,
        chatId,
      });
      await ctx.reply("No pude cargar este tema ahora mismo. Prueba con otro tema o pregunta libre.");
    }
  });

  bot.action(/^reply:(\d+)$/i, async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    const suggestionIndex = Number(ctx.match[1]);
    const session = getChatSession(chatId);
    const suggestion = session.suggestedReplies[suggestionIndex];

    if (!suggestion) {
      await ctx.answerCbQuery("Esa opcion ya no esta disponible");
      return;
    }

    await ctx.answerCbQuery();

    try {
      await processUserQuestion(ctx, chatId, suggestion);
    } catch (error) {
      logger.error("Failed to answer suggested reply", {
        error,
        chatId,
        suggestion,
      });
      await ctx.reply("No pude continuar por esa opcion ahora mismo. Escríbeme la duda libremente si quieres.");
    }
  });

  bot.on("text", async (ctx) => {
    const question = ctx.message.text.trim();

    if (!question) {
      await ctx.reply("No he recibido texto utilizable.");
      return;
    }

    try {
      await processUserQuestion(ctx, ctx.chat.id, question);

      if (getChatSession(ctx.chat.id).mode === "guided") {
        await ctx.reply("Si quieres cambiar de familia INSS o volver al inicio, usa estos botones:", buildMainMenuKeyboard());
      }
    } catch (error) {
      logger.error("Failed to answer user question", {
        error,
        chatId: ctx.chat.id,
      });

      await ctx.reply(
        "Ahora mismo no puedo responder con garantias. Intentalo de nuevo en unos minutos o consulta la sede oficial de la Seguridad Social.",
      );
    }
  });

  bot.catch((error) => {
    logger.error("Unhandled Telegram bot error", error);
  });
}
