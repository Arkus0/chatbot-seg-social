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
        "Hola. Soy un asistente informativo sobre la Seguridad Social espanola.",
        "",
        "Puedo ayudarte con prestaciones, tramites, documentos y pasos usando informacion oficial.",
        "Tambien puedes preguntar como preparar o rellenar una solicitud, si el contexto oficial lo permite.",
        "",
        "Importante: no sustituyo la informacion oficial ni el asesoramiento juridico personalizado.",
      ].join("\n"),
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
        "Ahora mismo no puedo responder con garantias. Intentalo de nuevo en unos minutos o consulta la sede oficial de la Seguridad Social.",
      );
    }
  });

  bot.catch((error) => {
    logger.error("Unhandled Telegram bot error", error);
  });
}
