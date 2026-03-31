import type { Context, Telegraf } from "telegraf";
import { Markup } from "telegraf";

import { getAnswer } from "../rag/getAnswer.js";
import { isTelegramStateExpired } from "../rag/conversation.js";
import { buildGuidedPrompt, getGuidedProcedureLibrary, getMenuGroups, getMenuGroupById } from "../rag/inssCatalog.js";
import type { MenuGroup } from "../rag/inssCatalog.js";
import type { AnswerPayload, AnswerSource, ChatState, RecommendedAction } from "../types/answers.js";
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
  recommendedActions: RecommendedAction[];
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
  const groupRows = getMenuGroups().map((group) => [Markup.button.callback(group.label, `menu:group:${group.groupId}`)]);
  const utilityRows = [
    [Markup.button.callback("Tengo otra duda", "menu:freetext")],
    [Markup.button.callback("Salir", "menu:exit")],
  ];
  return Markup.inlineKeyboard([...groupRows, ...utilityRows]);
}

function buildGroupSubMenuKeyboard(group: MenuGroup) {
  const topicRows = group.benefitIds.map((id) => [
    Markup.button.callback(group.subLabels[id] ?? id, `menu:topic:${id}`),
  ]);
  const navRows = [[Markup.button.callback("Volver al menu", "menu:home")]];
  return Markup.inlineKeyboard([...topicRows, ...navRows]);
}

function buildTopicKeyboard(topicId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Que necesito", `menu:topic:${topicId}:requisitos`)],
    [Markup.button.callback("Como lo pido", `menu:topic:${topicId}:solicitud`)],
    [Markup.button.callback("Seguir mi caso", `menu:topic:${topicId}:seguimiento`)],
    [Markup.button.callback("Volver al menu", "menu:home")],
  ]);
}

function buildRecommendedActionKeyboard(actions: RecommendedAction[]) {
  const limitedActions = actions.slice(0, 4);
  const rows = [];

  for (let index = 0; index < limitedActions.length; index += 2) {
    const row = limitedActions
      .slice(index, index + 2)
      .map((_, offset) => Markup.button.callback(limitedActions[index + offset]!.label, `reply:${index + offset}`));
    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

function createEmptySession(mode: ChatMode = "free", topicId?: string): ChatSession {
  return {
    mode,
    topicId,
    state: undefined,
    recommendedActions: [],
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
    recommendedActions: [],
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
    recommendedActions: answer.recommendedActions,
  });

  for (const chunk of splitTelegramMessage(answer.text)) {
    await ctx.reply(chunk);
  }

  if (answer.sources.length > 0) {
    await ctx.reply("Abrir fuentes oficiales:", buildSourceKeyboard(answer.sources));
  }

  if (answer.recommendedActions.length > 0) {
    const helperText =
      answer.mode === "clarify"
        ? "Para afinar el caso, responde con una opcion o escribelo con tus palabras:"
        : "Si quieres seguir, puedes tocar una de estas opciones:";
    await ctx.reply(helperText, buildRecommendedActionKeyboard(answer.recommendedActions));
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
        "Hola. Soy un asistente sobre la Seguridad Social espanola.",
        "",
        "Puedo ayudarte con pensiones, bajas, prestaciones, documentos y tramites del INSS.",
        "Puedes escribirme tu duda directamente o usar los botones de abajo.",
        "",
        "Importante: no sustituyo la informacion oficial ni el asesoramiento juridico.",
      ].join("\n"),
    );

    await ctx.reply("Elige tu situacion o escribeme directamente tu pregunta:", buildMainMenuKeyboard());
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
    await ctx.reply("Elige tu situacion o escribeme directamente tu pregunta:", buildMainMenuKeyboard());
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

  bot.action("menu:freetext", async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    await ctx.answerCbQuery();
    resetChatState(chatId);
    await ctx.reply(
      "Escribeme tu pregunta con tus palabras. Por ejemplo:\n\n" +
        "- Estoy de baja y el INSS me ha mandado un papel, que hago?\n" +
        "- Quiero saber si me puedo jubilar ya\n" +
        "- Como pido el ingreso minimo vital?\n\n" +
        "No hace falta que uses palabras tecnicas.",
    );
  });

  bot.action(/^menu:group:(.+)$/i, async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    const groupId = ctx.match[1];
    const group = getMenuGroupById(groupId);

    if (!group) {
      await ctx.answerCbQuery("Grupo no disponible");
      return;
    }

    await ctx.answerCbQuery();
    setGuidedState(chatId);

    if (group.benefitIds.length === 1) {
      const topicId = group.benefitIds[0]!;
      const topic = MENU_TOPIC_BY_ID.get(topicId);

      if (!topic) {
        await ctx.reply("No pude cargar este tema. Prueba a escribirme tu pregunta directamente.");
        return;
      }

      setGuidedState(chatId, topic.id);

      try {
        await processUserQuestion(ctx, chatId, topic.prompt);
        await ctx.reply("Puedes seguir explorando:", buildTopicKeyboard(topic.id));
      } catch (error) {
        logger.error("Failed to answer single-topic group", { error, topicId, chatId });
        await ctx.reply("No pude cargar este tema ahora mismo. Prueba a escribirme tu pregunta directamente.");
      }
    } else {
      await ctx.reply("Elige la opcion que mejor encaja:", buildGroupSubMenuKeyboard(group));
    }
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
      await ctx.reply("Puedes seguir explorando:", buildTopicKeyboard(topic.id));
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
      await ctx.reply("Puedes seguir explorando:", buildTopicKeyboard(topic.id));
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
    const action = session.recommendedActions[suggestionIndex];

    if (!action) {
      await ctx.answerCbQuery("Esa opcion ya no esta disponible");
      return;
    }

    await ctx.answerCbQuery();

    try {
      await processUserQuestion(ctx, chatId, action.prompt);
    } catch (error) {
      logger.error("Failed to answer suggested reply", {
        error,
        chatId,
        prompt: action.prompt,
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
        await ctx.reply("Si quieres cambiar de tema o volver al inicio:", buildMainMenuKeyboard());
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
