# INSS Chat-First Manager

Gestor conversacional de Seguridad Social centrado en INSS para web y Telegram.
El producto ya no es solo un RAG que responde: intenta llevar el caso como un funcionario operativo, con el mismo nucleo conversacional, el mismo catalogo guiado y la misma estructura de respuesta en ambos canales.

## Que hace

- Detecta familia, operacion, `benefitId` y `lifecycleStage`.
- Mantiene `ChatState` compartido entre web y Telegram.
- Pide aclaraciones cortas cuando falta un dato que cambia materialmente la orientacion.
- Devuelve respuesta estructurada con `mode`, `intent`, `sections`, `clarifyingQuestions`, `suggestedReplies` y `state`.
- Prioriza fuentes oficiales del INSS y mantiene fast path lexico para no depender de embeddings en vivo.

## Cobertura actual del catalogo INSS

- Jubilacion y SOVI.
- Incapacidad temporal e incapacidad permanente.
- Nacimiento y cuidado de menor.
- Familia y cuidados especiales: cuidado de menor grave, riesgos durante embarazo o lactancia, corresponsabilidad en el cuidado del lactante, brecha de genero y prestaciones familiares.
- Viudedad, orfandad, favor de familiares y auxilio por defuncion.
- Asistencia sanitaria, TSE, CPS y alta de beneficiarios.
- Ingreso Minimo Vital.
- Seguro escolar.
- Prestaciones especiales INSS: violencia contra la mujer, actos terroristas, Sindrome Toxico y Amianto.
- Operativa comun del INSS: Portal de Prestaciones, Mis Expedientes, requerimientos, notificaciones y CAISS.

## Arquitectura

- `api/chat.ts`: contrato HTTP principal para web y Telegram.
- `api/catalog.ts`: expone el catalogo guiado compartido.
- `src/rag/conversation.ts`: clasificacion conversacional, slots, aclaraciones y estado.
- `src/rag/inssCatalog.ts`: catalogo INSS, aliases, prompt seeds y servicios comunes.
- `src/rag/query.ts` y `src/rag/retriever.ts`: expansion, priorizacion y recuperacion con metadata por prestacion y ciclo de vida.
- `src/bot/handlers.ts`: adaptador fino de Telegram con TTL de 30 minutos por chat.
- `main.js` y `web-content.js`: adaptador fino web que consume el mismo payload y el mismo catalogo.

## Endpoints

### `GET /api/health`

Comprueba salud del runtime y configuracion critica.

### `GET /api/catalog`

Devuelve:

```json
{
  "ok": true,
  "procedureLibrary": [],
  "demoQuestion": "..."
}
```

### `POST /api/chat`

Cuerpo minimo:

```json
{
  "question": "Tengo un requerimiento del INSS sobre IMV",
  "channel": "web",
  "state": {
    "family": "imv",
    "operation": "subsanacion-requerimiento",
    "benefitId": "imv",
    "lifecycleStage": "seguimiento"
  }
}
```

Campos clave de respuesta:

- `mode`
- `intent`
- `benefitId`
- `lifecycleStage`
- `text`
- `caseSummary`
- `checklist`
- `alternatives`
- `nextBestAction`
- `sections`
- `clarifyingQuestions`
- `suggestedReplies`
- `state`

### `POST /api/webhook`

Webhook de Telegram. Debe responder `200` rapido y procesar el trabajo pesado en background.

## Modos de ejecucion

- `BOT_MODE=echo`: valida Telegram y webhook sin IA.
- `BOT_MODE=llm`: usa solo el modelo, sin Pinecone.
- `BOT_MODE=rag`: activa recuperacion con corpus oficial y respuesta con contexto.

## Comandos

```bash
npm install
npm run dev
npm run dev:vercel
npm run test
npm run typecheck
npm run lint
npm run build:corpus
npm run ingest
npm run ask -- "Como sigo un expediente del INSS"
npm run smoke
npm run set:webhook
npm run webhook:info
npm run telegram:commands
```

## Limites conocidos

- Gemini embeddings puede devolver `429` en ingestiones completas o consultas de embedding; el runtime sigue funcionando porque prioriza recuperacion lexica y fallback local.
- Pinecone puede ir por detras del fallback local cuando no hay cuota para reingestar.
- El estado de Telegram es efimero y en memoria; no hay persistencia compartida entre web y Telegram.

## Documentacion operativa

- [AGENTS.md](AGENTS.md): contexto estable del repo y guardrails.
- [docs/session-handoff.md](docs/session-handoff.md): estado actual y limites conocidos.
- [docs/operations.md](docs/operations.md): runbook de Vercel, salud, deploy y Telegram.
- [docs/corpus-roadmap.md](docs/corpus-roadmap.md): cobertura actual y siguientes bloques de corpus.
- [.agents/README.md](.agents/README.md): briefs cortos para plataforma, corpus y release.
