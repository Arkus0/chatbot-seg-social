# Operations Runbook

## Vercel

- Proyecto: `prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
- Team: `team_l8PhmvuV6TYXf87kaVVxX8zV`
- URL canonica: `https://chatbot-seg-social.vercel.app`

## Variables criticas

- `BOT_MODE=rag`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`

## Comandos utiles

```bash
node ./node_modules/vercel/dist/vc.js env ls production
node ./node_modules/vercel/dist/vc.js env ls preview
node ./node_modules/vercel/dist/vc.js env ls development
node ./node_modules/vercel/dist/vc.js deploy --prod --yes
npm run set:webhook
npm run webhook:info
```

## Verificacion rapida

### Salud

```bash
curl https://chatbot-seg-social.vercel.app/api/health
```

Esperado:

- `ok: true`
- `botMode: "rag"`
- `missingConfig: []`

### Chat

Prueba preguntas reales de alto valor:

- `Como solicito la tarjeta sanitaria europea y el certificado provisional sustitutorio?`
- `Como dar de alta a un beneficiario de asistencia sanitaria?`

### Telegram

```bash
npm run webhook:info
```

Esperado:

- `url = https://chatbot-seg-social.vercel.app/api/webhook`
- `pending_update_count = 0`
- sin `last_error_message`
- `allowed_updates` incluye `message` y `callback_query`

Comandos del bot recomendados:

- `/start`
- `/help`
- `/menu` (navegacion guiada por botones)
- `/reset` (salir de modo guiado)

## Incidencias tipicas

### `/api/health` muestra `missingConfig`

- Faltan env vars en Vercel.
- No aceptes modo degradado en produccion; corrige la configuracion.

### `/api/chat` se vuelve lento o hace timeout

- Revisa si se reintrodujo dependencia dura de embeddings.
- Manten el fast path lexico en `src/rag/retriever.ts`.
- No hagas retries largos en `embedQuery()` para consultas en vivo.

### Telegram devuelve 500 o deja de consumir updates

- Revisa `npm run webhook:info`.
- Reejecuta `npm run set:webhook`.
- Confirma que `api/webhook.ts` sigue devolviendo `200` rapido y usa `waitUntil()`.
- Si falla navegacion por botones, confirma que el webhook mantiene `callback_query` en `allowed_updates`.

## Ingestion RAG: estrategia de resume

La ingesta hacia Pinecone es incremental y resistente a fallos aislados por cuota/rate-limit:

- `ingestConfiguredSources()` solo hace reset de namespace si `RESET_VECTOR_NAMESPACE=true`.
- Cuando `RESET_VECTOR_NAMESPACE=false`, cada fuente se procesa en lotes de chunks (`INGEST_UPSERT_BATCH_SIZE`).
- Antes de cada lote se consulta Pinecone por IDs (`fetch`) para saltar lotes ya subidos.
- Si aparece un `429` en un lote concreto, se reintenta ese lote con backoff; los lotes ya confirmados no se repiten.
- Si el proceso se corta y se relanza, reanuda desde los lotes faltantes (no reinicia la fuente completa).

Variables recomendadas para operar con cuota limitada:

- `INGEST_UPSERT_BATCH_SIZE=16` o `32`
- `INGEST_UPSERT_THROTTLE_MS=300` a `1000`
- `EMBED_BATCH_SIZE=16` o `32` (batch de embeddings)

Ejemplo de ejecucion segura (sin reset):

```bash
RESET_VECTOR_NAMESPACE=false INGEST_UPSERT_BATCH_SIZE=32 INGEST_UPSERT_THROTTLE_MS=500 npm run ingest
```
