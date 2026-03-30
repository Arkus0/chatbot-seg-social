import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BOT_MODE: z.enum(["echo", "llm", "rag"]).default("echo"),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  APP_BASE_URL: z.string().url().optional(),
  LLM_PROVIDER: z.enum(["gemini", "groq"]).default("gemini"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite"),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  EMBEDDING_PROVIDER: z.enum(["gemini"]).default("gemini"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(768),
  PINECONE_API_KEY: z.string().min(1).optional(),
  PINECONE_INDEX_NAME: z.string().min(1).optional(),
  PINECONE_NAMESPACE: z.string().default("prod"),
  PINECONE_CLOUD: z.enum(["aws", "gcp", "azure"]).default("aws"),
  PINECONE_REGION: z.string().default("us-east-1"),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.75),
  MAX_CONTEXT_CHARS: z.coerce.number().int().min(1000).default(12000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}

function assertDefined(value: string | undefined, key: string): asserts value is string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
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
