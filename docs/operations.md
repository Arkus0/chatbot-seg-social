# Operations Runbook

## Vercel

- Proyecto: `prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
- Team: `team_l8PhmvuV6TYXf87kaVVxX8zV`
- URL canonica: `https://chatbot-seg-social.vercel.app`

## Variables criticas

- `BOT_MODE=rag`
- `APP_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`

## Rutas operativas

- `GET /api/health`: salud y config critica.
- `GET /api/catalog`: catalogo guiado compartido entre web y Telegram.
- `POST /api/chat`: contrato compartido del chat.
- `POST /api/webhook`: webhook de Telegram.

## Contrato actual de chat

### Entrada

`POST /api/chat` acepta:

```json
{
  "question": "Tengo un expediente del INSS y quiero saber el siguiente paso",
  "channel": "web",
  "state": {
    "family": "operativa-inss",
    "operation": "estado-expediente",
    "benefitId": "operativa-inss",
    "lifecycleStage": "seguimiento"
  }
}
```

### Salida

El payload de `answer` mantiene campos heredados y anade estado reutilizable:

- `mode`
- `intent`
- `benefitId`
- `lifecycleStage`
- `text`
- `summary`
- `keyPoints`
- `caseSummary`
- `checklist`
- `alternatives`
- `nextBestAction`
- `sections`
- `clarifyingQuestions`
- `suggestedReplies`
- `sources`
- `legalNotice`
- `state`

## Comandos utiles

```bash
node ./node_modules/vercel/dist/vc.js env ls production
node ./node_modules/vercel/dist/vc.js env ls preview
node ./node_modules/vercel/dist/vc.js env ls development
node ./node_modules/vercel/dist/vc.js deploy --prod --yes
npm run ask -- "Como sigo un expediente del INSS"
npm run smoke
npm run set:webhook
npm run webhook:info
npm run telegram:commands
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

### Catalogo guiado

```bash
curl https://chatbot-seg-social.vercel.app/api/catalog
```

Esperado:

- `ok: true`
- `procedureLibrary` con prestaciones guiadas
- `demoQuestion` no vacia

### Chat

Prueba preguntas reales de alto valor:

- `Tengo un requerimiento del INSS sobre IMV y quiero saber el siguiente paso`
- `Como solicito la tarjeta sanitaria europea y el certificado provisional sustitutorio`
- `Que documentos suelen pedir para una incapacidad permanente`

Revisa que la respuesta no vuelva a `Eco` y que mantenga fuentes oficiales.

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
- `/menu`
- `/reset`

## Incidencias tipicas

### `/api/health` muestra `missingConfig`

- Faltan env vars en Vercel.
- No aceptes modo degradado en produccion; corrige la configuracion.

### `/api/catalog` o el menu guiado quedan vacios

- Revisa `api/catalog.ts`.
- Revisa `src/rag/inssCatalog.ts`.
- Revisa `web-content.js`, `main.js` y `src/bot/handlers.ts`.
- No vuelvas a duplicar listas manuales de prestaciones entre web y Telegram.

### `/api/chat` se vuelve lento o pierde precision

- Revisa que el fast path lexico siga activo en `src/rag/retriever.ts`.
- Revisa `src/rag/query.ts` para boosts y penalizaciones por `benefitId`, `family`, `lifecycle` y `sourceKind`.
- Revisa `src/rag/conversation.ts` para clasificacion, carryover de estado y preguntas aclaratorias.
- No hagas retries largos en `embedQuery()` para consultas en vivo.

### Telegram devuelve 500 o deja de consumir updates

- Revisa `npm run webhook:info`.
- Reejecuta `npm run set:webhook`.
- Confirma que `api/webhook.ts` sigue devolviendo `200` rapido y usa `waitUntil()`.
- Si falla navegacion por botones, confirma que el webhook mantiene `callback_query` en `allowed_updates`.

### `npm run smoke` o `npm run ingest` fallan con `429`

- Gemini embeddings sigue siendo el cuello de botella conocido.
- Mantén `npm run build:corpus` al dia para no perder el fallback local.
- Reintenta `npm run ingest` solo cuando haya cuota.

## Ingesta RAG: estrategia de resume

La ingesta hacia Pinecone es incremental y resistente a fallos aislados por cuota o rate limit:

- `ingestConfiguredSources()` solo hace reset de namespace si `RESET_VECTOR_NAMESPACE=true`.
- Cuando `RESET_VECTOR_NAMESPACE=false`, cada fuente se procesa en lotes de chunks (`INGEST_UPSERT_BATCH_SIZE`).
- Antes de cada lote se consulta Pinecone por IDs (`fetch`) para saltar lotes ya subidos.
- Si aparece un `429` en un lote concreto, se reintenta ese lote con backoff; los lotes ya confirmados no se repiten.
- Si el proceso se corta y se relanza, reanuda desde los lotes faltantes.

Variables recomendadas para operar con cuota limitada:

- `INGEST_UPSERT_BATCH_SIZE=16` o `32`
- `INGEST_UPSERT_THROTTLE_MS=300` a `1000`
- `EMBED_BATCH_SIZE=16` o `32`

Ejemplo de ejecucion segura:

```bash
RESET_VECTOR_NAMESPACE=false INGEST_UPSERT_BATCH_SIZE=32 INGEST_UPSERT_THROTTLE_MS=500 npm run ingest
```
