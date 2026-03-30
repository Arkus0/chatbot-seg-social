# Corpus Agent

## Objetivo

Mejorar cobertura y precision del catalogo INSS sin romper tiempos de respuesta ni degradar la experiencia chat.

## Checklist

1. Si anades o cambias una prestacion, revisa `src/rag/inssCatalog.ts`.
2. Anade o ajusta fuentes en `data/seed/sources.json`.
3. Completa metadata cuando aplique:
   - `benefitId`
   - `lifecycle`
   - `sourceKind`
   - `priority`
   - `requiresAuth`
   - `supportsSms`
   - `formCodes`
4. Refuerza matching en `src/ingest/sourceHints.ts`.
5. Refuerza expansion, boosts y penalizaciones en `src/rag/query.ts`.
6. Si cambia el contrato de recuperacion, revisa `src/rag/retriever.ts` y `src/rag/lexicalRetriever.ts`.
7. Anade tests en `tests/query.test.ts`, `tests/conversation.test.ts`, `tests/fallback.test.ts` o `tests/rag.test.ts`.
8. Ejecuta:
   - `npm run test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build:corpus`
9. Si hay cuota para embeddings, lanza `npm run ingest`.

## Regla actual

- El fallback corpus es parte del runtime real. Si Pinecone se queda atras por cuota, la app sigue dependiendo del fallback local.
- La fuente de verdad para catalogo guiado y aliases conversacionales es `src/rag/inssCatalog.ts`.
- Prioriza siempre dominios oficiales directos antes que contenido editorial o de apoyo.

## Prioridades de contenido

- Mas fuentes oficiales operativas para `familia-cuidados`.
- Mas detalle por supuesto en `seguro-escolar`.
- Mas ramas oficiales para `prestaciones-especiales`.
- Formularios y guias de datos cuando la fuente oficial lo permita.
- Revision, reclamacion previa, cuantia y pago por prestacion cuando exista pagina oficial.
