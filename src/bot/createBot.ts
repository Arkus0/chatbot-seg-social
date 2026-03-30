import { Telegraf } from "telegraf";

import { assertTelegramEnv, getEnv } from "../config/env.js";
import { registerHandlers } from "./handlers.js";

let botInstance: Telegraf | undefined;

export function createBot(): Telegraf {
  if (botInstance) {
    return botInstance;
  }

  const env = getEnv();
  assertTelegramEnv(env);

  botInstance = new Telegraf(env.TELEGRAM_BOT_TOKEN!);
  registerHandlers(botInstance);

  return botInstance;
}
