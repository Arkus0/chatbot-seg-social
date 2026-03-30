import type { Context, Telegraf } from "telegraf";
import { Markup } from "telegraf";

import { getAnswer } from "../rag/getAnswer.js";
import type { AnswerPayload, AnswerSource } from "../types/answers.js";
import { logger } from "../utils/logger.js";
import { splitTelegramMessage } from "../utils/text.js";

function buildSourceButtonLabel(source: AnswerSource, index: number): string {
  const compactTitle = source.title.replace(/\s+/g, " ").trim();
  const clippedTitle = compactTitle.length > 42 ? `${compactTitle.slice(0, 39).trimEnd()}...` : compactTitle;
  return `${index + 1}. ${clippedTitle}`;
}

function buildSourceKeyboard(sources: AnswerSource[]) {
  const rows = sources.map((source, index) => [Markup.button.url(buildSourceButtonLabel(source, index), source.url)]);
  return Markup.inlineKeyboard(rows);
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
    await ctx.reply(
      [
        "Hola. Soy un asistente informativo sobre la Seguridad Social española.",
        "",
        "Puedo ayudarte a localizar información oficial sobre trámites, prestaciones y procedimientos.",
        "",
        "Importante: no sustituyo la información oficial ni el asesoramiento jurídico personalizado.",
      ].join("\n"),
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "Envíame una pregunta en lenguaje natural.",
        "",
        "Ejemplos:",
        "- ¿Cómo pedir el Ingreso Mínimo Vital?",
        "- ¿Qué necesito para solicitar la jubilación?",
        "- ¿Dónde consulto mi vida laboral?",
      ].join("\n"),
    );
  });

  bot.on("text", async (ctx) => {
    const question = ctx.message.text.trim();

    if (!question) {
      await ctx.reply("No he recibido texto utilizable.");
      return;
    }

    try {
      await ctx.sendChatAction("typing");
      const answer = await getAnswer(question);
      await replyWithAnswer(ctx, answer);
    } catch (error) {
      logger.error("Failed to answer user question", {
        error,
        chatId: ctx.chat.id,
      });

      await ctx.reply(
        "Ahora mismo no puedo responder con garantías. Inténtalo de nuevo en unos minutos o consulta la sede oficial de la Seguridad Social.",
      );
    }
  });

  bot.catch((error) => {
    logger.error("Unhandled Telegram bot error", error);
  });
}
