# Corpus Roadmap

## Catalogo INSS ya incorporado al repo

- Jubilacion.
- Incapacidad temporal.
- Incapacidad permanente.
- Nacimiento y cuidado de menor.
- Familia y cuidados especiales.
- Viudedad.
- Supervivencia.
- Asistencia sanitaria.
- TSE y CPS.
- Alta de beneficiarios.
- IMV.
- SOVI.
- Seguro escolar.
- Prestaciones especiales INSS.
- Operativa comun del INSS.

## Fuentes y metadatos ya activos

- `data/seed/sources.json` ya admite metadata por prestacion y ciclo de vida.
- `src/ingest/sourceHints.ts` y `src/rag/query.ts` ya trabajan con:
  - `benefitId`
  - `family`
  - `lifecycle`
  - `sourceKind`
  - `priority`
  - `requiresAuth`
  - `supportsSms`
  - `formCodes`
- Hay capa comun de servicios INSS para Portal de Prestaciones, Mis Expedientes, CAISS, certificados y vias de solicitud.
- La prioridad editorial ya favorece `seg-social.es`, `sede.seg-social.gob.es`, `portal.seg-social.gob.es` y servicios oficiales frente a `revista.seg-social.es`.

## Ultimas ampliaciones de fuentes oficiales

- Prestaciones familiares.
- Corresponsabilidad en el cuidado del lactante.
- Pensiones SOVI.
- Seguro escolar.
- Violencia contra la mujer.
- Prestaciones por actos terroristas.
- Sindrome Toxico.
- Amianto.

## Regla minima por nueva prestacion

Cada nueva prestacion o subprestacion debe tener, como minimo:

1. Pagina canonica oficial.
2. Requisitos o documentacion oficial.
3. Via oficial de solicitud o presentacion.
4. Via oficial de seguimiento o, si no existe una propia, capa comun de `Mis Expedientes` o servicio equivalente.

Si existen fuentes oficiales, intenta anadir tambien:

- cuantia
- plazos
- compatibilidades
- pago
- revision o reclamacion previa

## Huecos con mas retorno ahora

1. `familia-cuidados`
   - mas paginas oficiales por subcaso
   - mas formularios y guias de datos
   - mas cobertura de cuantia, suspension y revision
2. `seguro-escolar`
   - mas detalle por supuesto cubierto
   - mas documentacion y tramites de expediente
3. `prestaciones-especiales`
   - mas fuentes oficiales operativas por rama
   - mas paginas de seguimiento, resolucion y revision cuando existan
4. `supervivencia`
   - separar mejor orfandad, favor de familiares y auxilio por defuncion cuando haya fuentes propias
5. Pinecone
   - reingestar cuando haya cuota para alinear el indice con el fallback local actualizado

## Flujo correcto al tocar corpus

1. Cambia `data/seed/sources.json`.
2. Refuerza `src/ingest/sourceHints.ts`.
3. Refuerza `src/rag/query.ts`.
4. Si anades una nueva prestacion o alias guiado, actualiza `src/rag/inssCatalog.ts`.
5. Cubre el caso con tests en `tests/query.test.ts`, `tests/conversation.test.ts`, `tests/fallback.test.ts` o `tests/rag.test.ts`.
6. Ejecuta `npm run build:corpus`.
7. Reintenta `npm run ingest` solo si hay cuota.

## Regla editorial

- Prioriza `seg-social.es`, `sede.seg-social.gob.es`, `portal.seg-social.gob.es` y paginas oficiales de prestaciones.
- Usa `revista.seg-social.es` como apoyo, no como fuente primaria cuando exista alternativa oficial directa.
- Para "como rellenar", solo afirma campos, casillas o pasos si la fuente oficial lo permite de forma explicita.
- Si una fuente no permite cerrar una rama con seguridad, es mejor dejar al chat en modo aclaracion que completar con inferencias blandas.
- El fallback corpus es parte del runtime real; no lo trates como artefacto secundario.
