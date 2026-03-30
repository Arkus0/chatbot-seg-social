import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getEffectiveBotMode,
  getEnv,
  getMissingConfig,
  resetEnvCache,
} from "../src/config/env.js";

const originalEnv = { ...process.env };

function setEnv(entries: Record<string, string | undefined>): void {
  process.env = { ...originalEnv };

  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  resetEnvCache();
}

describe("environment runtime helpers", () => {
  beforeEach(() => {
    setEnv({});
  });

  afterAll(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  it("defaults to echo only outside production", () => {
    setEnv({
      BOT_MODE: undefined,
      NODE_ENV: "development",
    });

    expect(getEffectiveBotMode(getEnv())).toBe("echo");
  });

  it("reports BOT_MODE when production has no explicit mode", () => {
    setEnv({
      APP_BASE_URL: undefined,
      BOT_MODE: undefined,
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_WEBHOOK_SECRET: undefined,
    });

    const env = getEnv();

    expect(getEffectiveBotMode(env)).toBeNull();
    expect(getMissingConfig(env, "health")).toEqual([
      "BOT_MODE",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "APP_BASE_URL",
    ]);
  });

  it("flags webhook credentials explicitly when they are missing", () => {
    setEnv({
      BOT_MODE: "rag",
      NODE_ENV: "production",
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_WEBHOOK_SECRET: undefined,
    });

    expect(getMissingConfig(getEnv(), "webhook")).toEqual([
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "GEMINI_API_KEY",
    ]);
  });

  it("requires vector and embedding keys on health for rag", () => {
    setEnv({
      APP_BASE_URL: "https://chatbot-seg-social.vercel.app",
      BOT_MODE: "rag",
      EMBEDDING_PROVIDER: "openai",
      NODE_ENV: "production",
      OPENAI_API_KEY: undefined,
      PINECONE_API_KEY: undefined,
      PINECONE_INDEX_NAME: undefined,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
    });

    expect(getMissingConfig(getEnv(), "health")).toEqual([
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "PINECONE_API_KEY",
      "PINECONE_INDEX_NAME",
    ]);
  });
});
