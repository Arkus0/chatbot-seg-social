# Platform Agent

## Objetivo

Mantener web y Telegram operativos en produccion con el mismo comportamiento conversacional.

## Checklist

1. Verifica `https://chatbot-seg-social.vercel.app/api/health`.
2. Esperado:
   - `botMode: "rag"`
   - `missingConfig: []`
   - `configured.telegram/gemini/groq/pinecone: true`
3. Si tocas experiencia chat, revisa que `POST /api/chat` siga aceptando `question`, `channel` y `state`.
4. Si tocas menu guiado, revisa `GET /api/catalog` y confirma que web y Telegram salen del mismo catalogo.
5. Si falla Telegram:
   - `npm run webhook:info`
   - `npm run set:webhook`
   - confirma `url = https://chatbot-seg-social.vercel.app/api/webhook`
   - confirma `allowed_updates` con `message` y `callback_query`
6. Si `/api/chat` se vuelve lento o pierde precision:
   - revisa que el fast path lexico siga activo
   - no reintroduzcas retries largos de embeddings en consultas en vivo
   - revisa `src/rag/conversation.ts` para carryover de estado y aclaraciones
7. Si hay desajuste entre web y Telegram:
   - revisa `src/rag/inssCatalog.ts`
   - revisa `api/catalog.ts`
   - revisa `main.js`, `web-content.js` y `src/bot/handlers.ts`

## Notas utiles

- En Windows, evita `vercel.cmd api ...?x=1&y=2` porque `&` rompe el comando.
- Usa `node ./node_modules/vercel/dist/vc.js api '...'` cuando haya query params.
- El webhook usa `waitUntil()` para contestar `200` rapido.
- Telegram mantiene estado en memoria por chat con TTL de 30 minutos.
