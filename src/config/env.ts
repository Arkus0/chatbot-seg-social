import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const BOT_MODES = ["echo", "llm", "rag"] as const;
const CONFIG_KEY_ORDER = [
  "BOT_MODE",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "APP_BASE_URL",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "PINECONE_API_KEY",
  "PINECONE_INDEX_NAME",
] as const;

export type BotMode = (typeof BOT_MODES)[number];
export type RuntimeConfigScope = "chat" | "health" | "webhook";

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return value;
}, z.boolean().default(false));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BOT_MODE: z.enum(BOT_MODES).optional(),
  TELEGRAM_BOT_TOKEN: optionalNonEmptyString,
  TELEGRAM_WEBHOOK_SECRET: optionalNonEmptyString,
  APP_BASE_URL: z.string().url().optional(),
  LLM_PROVIDER: z.enum(["gemini", "groq"]).default("gemini"),
  GEMINI_API_KEY: optionalNonEmptyString,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite"),
  GROQ_API_KEY: optionalNonEmptyString,
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  EMBEDDING_PROVIDER: z.enum(["gemini"]).default("gemini"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(3072),
  PINECONE_API_KEY: optionalNonEmptyString,
  PINECONE_INDEX_NAME: optionalNonEmptyString,
  PINECONE_NAMESPACE: z.string().default("prod"),
  PINECONE_CLOUD: z.enum(["aws", "gcp", "azure"]).default("aws"),
  PINECONE_REGION: z.string().default("us-east-1"),
  RESET_VECTOR_NAMESPACE: booleanFromString,
  FORCE_REEMBED_EXISTING: booleanFromString,
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.75),
  MAX_CONTEXT_CHARS: z.coerce.number().int().min(1000).default(12000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export class EnvConfigurationError extends Error {
  missingKeys: string[];
  scope: RuntimeConfigScope;

  constructor(scope: RuntimeConfigScope, missingKeys: string[]) {
    super(`Missing required environment variables for ${scope}: ${missingKeys.join(", ")}`);
    this.name = "EnvConfigurationError";
    this.missingKeys = missingKeys;
    this.scope = scope;
  }
}

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}

function assertDefined(value: string | undefined, key: string): asserts value is string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function addMissingKey(
  missingKeys: Set<string>,
  key: (typeof CONFIG_KEY_ORDER)[number],
  value: string | undefined,
): void {
  if (!value) {
    missingKeys.add(key);
  }
}

function addGenerationMissingKeys(missingKeys: Set<string>, env: AppEnv): void {
  if (env.LLM_PROVIDER === "gemini") {
    addMissingKey(missingKeys, "GEMINI_API_KEY", env.GEMINI_API_KEY);
    return;
  }

  addMissingKey(missingKeys, "GROQ_API_KEY", env.GROQ_API_KEY);
}

function addRagMissingKeys(missingKeys: Set<string>, env: AppEnv): void {
  addGenerationMissingKeys(missingKeys, env);
  addMissingKey(missingKeys, "GEMINI_API_KEY", env.GEMINI_API_KEY);
  addMissingKey(missingKeys, "PINECONE_API_KEY", env.PINECONE_API_KEY);
  addMissingKey(missingKeys, "PINECONE_INDEX_NAME", env.PINECONE_INDEX_NAME);
}

function sortMissingKeys(keys: Iterable<string>): string[] {
  const order = new Map(CONFIG_KEY_ORDER.map((key, index) => [key, index]));

  return [...keys].sort((left, right) => {
    const leftOrder = order.get(left as (typeof CONFIG_KEY_ORDER)[number]) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right as (typeof CONFIG_KEY_ORDER)[number]) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.localeCompare(right);
  });
}

export function getEffectiveBotMode(env: AppEnv): BotMode | null {
  if (env.BOT_MODE) {
    return env.BOT_MODE;
  }

  return env.NODE_ENV === "production" ? null : "echo";
}

export function getRequiredBotMode(env: AppEnv): BotMode {
  const mode = getEffectiveBotMode(env);

  if (!mode) {
    throw new EnvConfigurationError("chat", ["BOT_MODE"]);
  }

  return mode;
}

export function getMissingConfig(env: AppEnv, scope: RuntimeConfigScope = "health"): string[] {
  const missingKeys = new Set<string>();
  const botMode = getEffectiveBotMode(env);

  if (env.NODE_ENV === "production" && !env.BOT_MODE) {
    missingKeys.add("BOT_MODE");
  }

  if (scope === "webhook" || scope === "health") {
    addMissingKey(missingKeys, "TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN);
    addMissingKey(missingKeys, "TELEGRAM_WEBHOOK_SECRET", env.TELEGRAM_WEBHOOK_SECRET);
  }

  if (scope === "health") {
    addMissingKey(missingKeys, "APP_BASE_URL", env.APP_BASE_URL);
  }

  if (botMode === "llm") {
    addGenerationMissingKeys(missingKeys, env);
  }

  if (botMode === "rag") {
    addRagMissingKeys(missingKeys, env);
  }

  return sortMissingKeys(missingKeys);
}

export function assertRuntimeConfig(env: AppEnv, scope: RuntimeConfigScope): void {
  const missingKeys = getMissingConfig(env, scope);

  if (missingKeys.length > 0) {
    throw new EnvConfigurationError(scope, missingKeys);
  }
}

export function isEnvConfigurationError(error: unknown): error is EnvConfigurationError {
  return error instanceof EnvConfigurationError;
}

export function assertTelegramEnv(env: AppEnv): void {
  assertDefined(env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  assertDefined(env.TELEGRAM_WEBHOOK_SECRET, "TELEGRAM_WEBHOOK_SECRET");
}

export function assertWebhookUrlEnv(env: AppEnv): void {
  assertTelegramEnv(env);
  assertDefined(env.APP_BASE_URL, "APP_BASE_URL");
}

export function assertGenerationEnv(env: AppEnv): void {
  if (env.LLM_PROVIDER === "gemini") {
    assertDefined(env.GEMINI_API_KEY, "GEMINI_API_KEY");
    return;
  }

  assertDefined(env.GROQ_API_KEY, "GROQ_API_KEY");
}

export function assertRagEnv(env: AppEnv): void {
  assertGenerationEnv(env);
  assertDefined(env.GEMINI_API_KEY, "GEMINI_API_KEY");
  assertDefined(env.PINECONE_API_KEY, "PINECONE_API_KEY");
  assertDefined(env.PINECONE_INDEX_NAME, "PINECONE_INDEX_NAME");
}
