# Platform Agent

## Objetivo

Mantener web y Telegram operativos en produccion.

## Checklist

1. Verifica `https://chatbot-seg-social.vercel.app/api/health`.
2. Esperado:
   - `botMode: "rag"`
   - `missingConfig: []`
   - `configured.telegram/gemini/groq/pinecone: true`
3. Si falla Telegram:
   - `npm run webhook:info`
   - `npm run set:webhook`
   - confirma `url = https://chatbot-seg-social.vercel.app/api/webhook`
4. Si hay errores de config:
   - sincroniza envs con Vercel
   - no dejes `BOT_MODE` vacio en produccion
5. Si `/api/chat` se vuelve lento:
   - revisa que el fast path lexico siga activo en `src/rag/retriever.ts`
   - no reintroduzcas retries de embeddings en consultas en vivo

## Notas utiles

- En Windows, evita `vercel.cmd api ...?x=1&y=2` porque `&` rompe el comando.
- Usa `node ./node_modules/vercel/dist/vc.js api '...'` cuando haya query params.
- El webhook usa `waitUntil()` para contestar `200` rapido.
