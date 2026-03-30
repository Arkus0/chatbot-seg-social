# Telegram Seg Social Bot

Bot de Telegram en Node.js + TypeScript desplegable en Vercel, con arquitectura RAG sobre Pinecone y generación con Gemini o Groq.

## Objetivo

- Canal: Telegram Bot API con `telegraf`
- Backend: Vercel Serverless Functions
- Framework RAG: LangChain.js
- Embeddings: Gemini
- Vector DB: Pinecone Starter
- Modelo de respuesta: Gemini o Groq
- Dimensión de embeddings por defecto: `3072` con la integración actual de Gemini en LangChain

## Flujo

1. Telegram envía un `Update` al webhook `/api/webhook`.
2. El endpoint valida el `secret_token`.
3. El bot procesa el mensaje y llama al pipeline RAG.
4. El sistema recupera fragmentos relevantes desde Pinecone.
5. El LLM responde solo con base en el contexto recuperado.
6. El bot devuelve la respuesta al usuario con aviso legal y enlaces oficiales.

## Estructura

```txt
api/
  health.ts
  webhook.ts
src/
  bot/
  config/
  ingest/
  providers/
  rag/
  services/
  types/
  utils/
scripts/
tests/
data/
```

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run ingest
npm run set:webhook
```

## Modos de ejecución

- `BOT_MODE=echo`: valida Telegram y webhook sin IA.
- `BOT_MODE=llm`: usa solo el modelo, sin Pinecone.
- `BOT_MODE=rag`: activa recuperación desde Pinecone y respuesta con contexto.

## Webhook local con ngrok

### 1. Arrancar Vercel en local

```bash
npm run dev
```

### 2. Exponer el puerto 3000

```bash
ngrok http 3000
```

### 3. Configurar el webhook

Pon `APP_BASE_URL` con la URL pública de ngrok y ejecuta:

```bash
npm run set:webhook
```
