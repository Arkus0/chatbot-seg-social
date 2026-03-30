import type { Context, Telegraf } from "telegraf";

import { getEnv } from "../config/env.js";
import { answerWithLlm } from "../rag/answerWithLlm.js";
import { answerQuestion } from "../rag/answerQuestion.js";
import { logger } from "../utils/logger.js";
import { splitTelegramMessage } from "../utils/text.js";

async function replyInChunks(ctx: Context, message: string): Promise<void> {
  for (const chunk of splitTelegramMessage(message)) {
    await ctx.reply(chunk);
  }
}

export function registerHandlers(bot: Telegraf): void {
  const env = getEnv();

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
      const answer =
        env.BOT_MODE === "echo"
          ? `Eco: ${question}`
          : env.BOT_MODE === "llm"
            ? await answerWithLlm(question)
            : await answerQuestion(question);

      await replyInChunks(ctx, answer);
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
