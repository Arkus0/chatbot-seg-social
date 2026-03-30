# Operations Runbook

## Vercel

- Proyecto: `prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
- Team: `team_l8PhmvuV6TYXf87kaVVxX8zV`
- URL canonica: `https://chatbot-seg-social.vercel.app`

## Variables criticas (matriz por modo/proveedor)

### Base runtime (produccion)

- `BOT_MODE=rag`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_BASE_URL`

### Query-time (`/api/chat` y `/api/webhook`)

- Siempre: claves de generacion segun `LLM_PROVIDER`
  - `LLM_PROVIDER=gemini` -> `GEMINI_API_KEY`
  - `LLM_PROVIDER=groq` -> `GROQ_API_KEY`
- Opcional para retrieval vectorial (si faltan, runtime usa fallback lexico):
  - `PINECONE_API_KEY`
  - `PINECONE_INDEX_NAME`
  - claves segun `EMBEDDING_PROVIDER`:
    - `gemini` -> `GEMINI_API_KEY`
    - `local` -> sin clave
    - `openai` -> `OPENAI_API_KEY`
    - `voyage` -> `VOYAGE_API_KEY`

### Ingest-time (`npm run ingest`)

- Validacion estricta:
  - claves de generacion segun `LLM_PROVIDER`
  - `PINECONE_API_KEY`
  - `PINECONE_INDEX_NAME`
  - clave del proveedor de embedding (`EMBEDDING_PROVIDER`) segun matriz anterior

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

## Incidencias tipicas

### `/api/health` muestra `missingConfig`

- Faltan env vars en Vercel.
- No aceptes modo degradado en produccion; corrige la configuracion.

### `/api/chat` se vuelve lento o hace timeout

- Revisa si se reintrodujo dependencia dura de embeddings.
- Manten el fast path lexico en `src/rag/retriever.ts`.
- No hagas retries largos en `embedQuery()` para consultas en vivo.
- Si faltan claves vectoriales en query-time, debe seguir respondiendo via retrieval lexico.

### Telegram devuelve 500 o deja de consumir updates

- Revisa `npm run webhook:info`.
- Reejecuta `npm run set:webhook`.
- Confirma que `api/webhook.ts` sigue devolviendo `200` rapido y usa `waitUntil()`.
