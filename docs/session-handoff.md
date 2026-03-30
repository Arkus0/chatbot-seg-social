# Session Handoff

Actualizado el 2026-03-30.

## Estado estable

- Produccion en `BOT_MODE=rag`.
- `GET /api/health` devuelve `botMode: "rag"` y `missingConfig: []`.
- `POST /api/chat` responde de nuevo con fuentes oficiales.
- `POST /api/webhook` responde rapido y procesa Telegram en background.
- Proyecto Vercel canonico:
  - `projectId = prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
  - `teamId = team_l8PhmvuV6TYXf87kaVVxX8zV`

## Que se corrigio

- Produccion ya no cae en `echo` cuando faltan env vars.
- `api/health.ts` expone `botMode` y `missingConfig`.
- `api/chat.ts` y `api/webhook.ts` devuelven errores de configuracion explicitos.
- El retriever usa fast path lexico para no depender de embeddings en consultas en vivo.
- `embedQuery()` ya no hace retries largos cuando Gemini embeddings esta sin cuota.
- El webhook de Telegram usa `waitUntil()` y devuelve `200` rapido.
- `EMBEDDING_PROVIDER` ahora soporta `gemini | local | openai | voyage` con validacion por proveedor.
- Query-time en `rag` permite degradar a solo retrieval lexico si vectorial no esta disponible.
- Ingest-time mantiene validacion estricta de claves del proveedor de embedding y Pinecone.

## Verificaciones ya hechas

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build:corpus`
- `npm run set:webhook`
- `npm run webhook:info`

## Limite conocido

- Gemini embeddings sigue en cuota para ingestiones completas. `npm run ingest` puede fallar con `429`.
- La app sigue funcionando porque el fallback corpus local esta reconstruido y el runtime prioriza la recuperacion lexica cuando hay suficiente contexto.

## Matriz rapida de variables

- Runtime base (prod): `BOT_MODE`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_BASE_URL`.
- Query-time (`/api/chat`, `/api/webhook`):
  - Generacion: `GEMINI_API_KEY` o `GROQ_API_KEY` segun `LLM_PROVIDER`.
  - Vectorial opcional: `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` y clave del `EMBEDDING_PROVIDER`.
  - Si faltan claves vectoriales, se mantiene retrieval lexico.
- Ingest-time (`npm run ingest`):
  - Requiere generacion + Pinecone + clave segun `EMBEDDING_PROVIDER`:
    - `gemini` -> `GEMINI_API_KEY`
    - `local` -> sin clave
    - `openai` -> `OPENAI_API_KEY`
    - `voyage` -> `VOYAGE_API_KEY`

## Siguiente foco recomendado

1. Profundizar mutualistas y mar / ISM con mas formularios y tramites reales.
2. Seguir ampliando guias de "como rellenar".
3. Reintentar ingest completo cuando haya cuota disponible o se cambie de proveedor de embeddings.
