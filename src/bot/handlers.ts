import type { Context, Telegraf } from "telegraf";
import { Markup } from "telegraf";

import { getAnswer } from "../rag/getAnswer.js";
import type { AnswerPayload, AnswerSource } from "../types/answers.js";
import { logger } from "../utils/logger.js";
import { splitTelegramMessage } from "../utils/text.js";

type MenuTopic = {
  id: string;
  label: string;
  prompt: string;
};

type ChatMode = "free" | "guided";

type ChatState = {
  mode: ChatMode;
  topicId?: string;
};

const chatStates = new Map<number, ChatState>();

const MENU_TOPICS: MenuTopic[] = [
  {
    id: "pensiones",
    label: "Pensiones",
    prompt: "Explica de forma breve las opciones de jubilacion y que requisitos mirar primero.",
  },
  {
    id: "incapacidades",
    label: "Incapacidades",
    prompt: "Resume incapacidad temporal y permanente, y que cambia al solicitar cada una.",
  },
  {
    id: "familia",
    label: "Familia e hijos",
    prompt: "Explica nacimiento y cuidado de menor, y la documentacion habitual para solicitarlo.",
  },
  {
    id: "tramites-inss",
    label: "Tramites INSS",
    prompt: "Dame una guia general para tramites del INSS: canales, identificacion y pasos habituales.",
  },
  {
    id: "estado",
    label: "Estado solicitud",
    prompt: "Como consultar el estado de una solicitud y que hacer si hay requerimientos de documentacion.",
  },
];

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
    [Markup.button.callback("Volver al menu", "menu:home")],
    [Markup.button.callback("Salir", "menu:exit")],
  ]);
}

function getChatState(chatId: number): ChatState {
  return chatStates.get(chatId) ?? { mode: "free" };
}

function setGuidedState(chatId: number, topicId?: string): void {
  chatStates.set(chatId, {
    mode: "guided",
    topicId,
  });
}

function resetChatState(chatId: number): void {
  chatStates.set(chatId, { mode: "free" });
}

function buildGuidedPrompt(topic: MenuTopic, action: "requisitos" | "documentacion" | "solicitud"): string {
  if (action === "requisitos") {
    return `Sobre ${topic.label}, explica requisitos y condiciones principales de acceso.`;
  }

  if (action === "documentacion") {
    return `Sobre ${topic.label}, indica documentacion habitual y comprobaciones previas antes de presentar solicitud.`;
  }

  return `Sobre ${topic.label}, explica como se solicita paso a paso y por que canales se puede presentar.`;
}

function resolveChatId(ctx: Context): number | null {
  if (ctx.chat?.id) {
    return ctx.chat.id;
  }

  const callbackMessageChatId = ctx.callbackQuery && "message" in ctx.callbackQuery ? ctx.callbackQuery.message?.chat.id : null;
  return callbackMessageChatId ?? null;
}

async function replyWithAnswer(ctx: Context, answer: AnswerPayload): Promise<void> {
  for (const chunk of splitTelegramMessage(answer.text)) {
    await ctx.reply(chunk);
  }

  if (answer.sources.length > 0) {
    await ctx.reply("Abrir fuentes oficiales:", buildSourceKeyboard(answer.sources));
  }
}

export function registerHandlers(bot: Telegraf): void {
  bot.start(async (ctx) => {
    resetChatState(ctx.chat.id);
    await ctx.reply(
      [
        "Hola. Soy un asistente informativo sobre la Seguridad Social espanola.",
        "",
        "Puedo ayudarte con prestaciones, tramites, documentos y pasos usando informacion oficial.",
        "Tambien puedes preguntar como preparar o rellenar una solicitud, si el contexto oficial lo permite.",
        "",
        "Importante: no sustituyo la informacion oficial ni el asesoramiento juridico personalizado.",
      ].join("\n"),
    );

    await ctx.reply(
      "Si quieres, puedes usar el menu guiado para navegar por temas y pedir detalles.",
      buildMainMenuKeyboard(),
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "Enviame una pregunta en lenguaje natural.",
        "",
        "Ejemplos:",
        "- Como pedir el Ingreso Minimo Vital",
        "- Que necesito para solicitar la jubilacion",
        "- Como rellenar la solicitud de viudedad",
        "- Donde consulto mi vida laboral",
        "",
        "Tambien puedes usar /menu para navegar por botones o /reset para salir del modo guiado.",
      ].join("\n"),
    );
  });

  bot.command("menu", async (ctx) => {
    setGuidedState(ctx.chat.id);
    await ctx.reply("Elige un tema para empezar:", buildMainMenuKeyboard());
  });

  bot.command("reset", async (ctx) => {
    resetChatState(ctx.chat.id);
    await ctx.reply("He salido del modo guiado. Ya puedes preguntar otra cosa libremente.");
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
    await ctx.reply("Has salido del menu guiado. Enviame otra pregunta cuando quieras.");
  });

  bot.action(/^menu:topic:(.+)$/i, async (ctx) => {
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
      await ctx.sendChatAction("typing");
      const answer = await getAnswer(topic.prompt);
      await replyWithAnswer(ctx, answer);
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

  bot.action(/^menu:topic:([^:]+):(requisitos|documentacion|solicitud)$/i, async (ctx) => {
    const chatId = resolveChatId(ctx);
    if (!chatId) {
      await ctx.answerCbQuery("Chat no disponible");
      return;
    }

    const topicId = ctx.match[1];
    const action = ctx.match[2] as "requisitos" | "documentacion" | "solicitud";
    const topic = MENU_TOPIC_BY_ID.get(topicId);

    if (!topic) {
      await ctx.answerCbQuery("Tema no disponible");
      return;
    }

    await ctx.answerCbQuery();
    setGuidedState(chatId, topic.id);

    try {
      await ctx.sendChatAction("typing");
      const answer = await getAnswer(buildGuidedPrompt(topic, action));
      await replyWithAnswer(ctx, answer);
      await ctx.reply("Puedes seguir navegando:", buildTopicKeyboard(topic.id));
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

  bot.on("text", async (ctx) => {
    const question = ctx.message.text.trim();

    if (!question) {
      await ctx.reply("No he recibido texto utilizable.");
      return;
    }

    try {
      const state = getChatState(ctx.chat.id);
      await ctx.sendChatAction("typing");
      const guidedQuestion =
        state.mode === "guided" && state.topicId
          ? `Contexto actual del menu: ${MENU_TOPIC_BY_ID.get(state.topicId)?.label ?? state.topicId}. Pregunta del usuario: ${question}`
          : question;
      const answer = await getAnswer(guidedQuestion);
      await replyWithAnswer(ctx, answer);

      if (state.mode === "guided") {
        await ctx.reply("Si quieres seguir en modo guiado, usa estos botones:", buildMainMenuKeyboard());
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
