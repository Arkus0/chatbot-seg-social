import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";

import { createBot } from "../src/bot/createBot.js";
import { assertRuntimeConfig, getEnv, isEnvConfigurationError } from "../src/config/env.js";
import { isTelegramSecretValid } from "../src/services/security.js";
import { logger } from "../src/utils/logger.js";

export default async function webhookHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const env = getEnv();

  try {
    assertRuntimeConfig(env, "webhook");
  } catch (error) {
    if (isEnvConfigurationError(error)) {
      logger.error("Telegram webhook misconfigured", {
        missingConfig: error.missingKeys,
      });

      res.status(503).json({
        ok: false,
        error: "Server configuration error",
        missingConfig: error.missingKeys,
      });
      return;
    }

    throw error;
  }

  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  const receivedSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

  if (!isTelegramSecretValid(receivedSecret, env.TELEGRAM_WEBHOOK_SECRET!)) {
    res.status(401).json({ ok: false, error: "Invalid secret token" });
    return;
  }

  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ ok: false, error: "Invalid Telegram update payload" });
    return;
  }

  try {
    const bot = createBot();
    waitUntil(
      bot.handleUpdate(req.body).catch((error) => {
        logger.error("Webhook processing failed", error);
      }),
    );
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("Webhook processing failed", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
