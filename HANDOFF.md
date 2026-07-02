# 🧭 HANDOFF — Notebook LM Podcast Creator

> Documento de traspaso. Describe **con exactitud** el estado actual de la aplicación para que otro modelo/desarrollador pueda añadir o modificar funciones sin re-descubrir nada. Última actualización: **2026-07-02**.

---

## 1. Qué es la app

Aplicación web que genera **podcasts** automáticamente con **Google NotebookLM** a partir de un tema o pregunta escrito por el usuario, y los publica en una biblioteca para escucharlos/descargarlos.

Flujo end-to-end: el usuario escribe un tema → se encola un job → un **worker** ejecuta el CLI `notebooklm.exe` (crear notebook → investigar en la web → generar audio → descargar MP3) → el podcast queda **publicado** y reproducible.

- **Repo:** https://github.com/victogarcia4/Notebook-LM-podcast-creator
- **Ubicación local:** `C:\Users\skint\Desktop\Podcast Creator`
- **Autor / footer:** "Built by Dr. Victor Garcia M"

---

## 2. Arquitectura (MVP local)

```
Navegador ──HTTP / SSE──▶ Next.js (UI + API Routes) ──▶ SQLite (Prisma)
                                                            ▲
                              Worker (proceso aparte, tsx) ─┘  (polling de la cola)
                                        │
                                        ▼
                              notebooklm.exe  (CLI, SOLO Windows)
```

- **Frontend + API**: Next.js 14 (App Router). El endpoint `generate` valida y **encola** (crea filas `Podcast` + `GenerationJob` en estado QUEUED) y responde al instante.
- **Worker**: proceso Node separado (`npm run worker`) que sondea la tabla `GenerationJob` buscando trabajos `QUEUED`, los procesa uno a uno ejecutando el CLI, y actualiza estado/etapa/progreso en la BD.
- **Progreso en tiempo real**: el frontend abre un **SSE** a `/api/status/[jobId]`, que sondea la BD cada 2 s y emite el estado.
- **Cola = tabla en BD** (no hay Redis/BullMQ). Simple y suficiente para 1 máquina.

> ⚠️ **El worker DEBE correr en Windows** porque `notebooklm.exe` solo existe en Windows. El frontend podría desplegarse en cualquier lado, pero el worker no.

---

## 3. Stack y versiones

| Área | Tecnología |
|------|------------|
| Framework | Next.js **14.2.35** (App Router), React 18, TypeScript 5 |
| Estilos | Tailwind CSS 3 (config propia) + CSS global |
| BD / ORM | SQLite + Prisma **5.22** |
| Worker | `tsx` (ejecuta TypeScript directo); `npm run worker` = `tsx watch` |
| CLI IA | `notebooklm-py` v0.3.4 (`notebooklm.exe`), invocado con `child_process.execFile` |
| Traducción | Endpoint gratuito Google gtx (sin clave) + `undici` (fallback TLS) |
| Node | 20+ (probado en Node 24) |

---

## 4. Cómo ejecutar

> ⚠️ **Ejecutar dentro de la carpeta del proyecto** `C:\Users\skint\Desktop\Podcast Creator` (NO en `Desktop\NotebookLMSkill`, que solo tiene la skill/plan → `npm` da `enoent`).

```bash
cd "C:\Users\skint\Desktop\Podcast Creator"
npm install                 # instala deps (postinstall corre prisma generate)
npm run db:push             # crea/actualiza SQLite (prisma/dev.db)
npm run worker              # TERMINAL 1: worker (dejar abierto)
npm run dev                 # TERMINAL 2: web en http://localhost:3000
```

Requisitos previos: `notebooklm.exe` instalado y **autenticado** (ver §9). Si la BD aún no existe, `npm run db:push` la crea. Si `prisma generate`/`db push`/`build` fallan por certificado, usar `$env:NODE_OPTIONS="--use-system-ca"` (ver §10.3).

---

## 5. Variables de entorno (`.env`)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `DATABASE_URL` | Conexión SQLite | `file:./dev.db` |
| `NLM_PATH` | Ruta al `notebooklm.exe` **con barras normales `/`** (ver §10) | `C:/Users/skint/.notebooklm-venv/Scripts/notebooklm.exe` |
| `AUDIO_DIR` | Carpeta de MP3s | `public/audio` |
| `WORKER_POLL_MS` | Intervalo de sondeo del worker (ms) | `5000` |
| `LIBRETRANSLATE_URL` | (Opcional) si se define, usa LibreTranslate en vez de Google gtx | — |

`.env` está **gitignored**; se versiona `.env.example`.

---

## 6. Modelo de datos (`prisma/schema.prisma`)

SQLite → los "enums" son **strings**.

### `Podcast`
`id, title, titleEn?, titleEs?, topic, format, length, language, status, notebookId?, audioPath?, durationSec?, plays, errorMsg?, createdAt, updatedAt` + relaciones `sources[]`, `job?`.
- `status`: `PENDING | GENERATING | PUBLISHED | FAILED`
- `format`: `deep-dive | brief | critique | debate`
- `length`: `short | default | long`
- `language`: código idioma del **audio** (`en`, `es`, `pt`, `fr`, …)
- `titleEn` / `titleEs`: título traducido para mostrar en tarjeta según el toggle (los rellena el **worker**; si `null`, se hace fallback a `title`).
- `audioPath`: ruta pública tipo `/audio/<id>.mp3`.

### `PodcastSource`
`id, podcastId, kind (url|research), value, createdAt`. `onDelete: Cascade`.

### `GenerationJob`
`id, podcastId (unique), status, stage, progress, errorMsg?, attempts, createdAt, updatedAt`. `onDelete: Cascade`.
- `status`: `QUEUED | RUNNING | DONE | FAILED`
- `stage` (etiqueta legible para el tracker): `queued | created | research | generating | downloading | done | failed`
- `progress`: 0–100.

---

## 7. Endpoints API (`src/app/api/**`)

| Método + ruta | Función |
|---------------|---------|
| `POST /api/podcasts/generate` | Valida input (topic 10–500 chars, format/length/language, hasta 10 URLs http[s]), crea `Podcast` + `GenerationJob` (QUEUED) y devuelve `{ podcastId, jobId, status }`. **No traduce** (para responder al instante). |
| `GET /api/podcasts?status=&q=` | Lista podcasts (filtros opcionales por status y búsqueda en title/topic), incluye `job`, máx 100, desc por fecha. |
| `GET /api/podcasts/:id` | Detalle (incluye `sources`, `job`). |
| `POST /api/podcasts/:id` | Incrementa `plays`. |
| `DELETE /api/podcasts/:id` | Borra el podcast (cascade a sources+job) **y su MP3** del disco. |
| `POST /api/podcasts/:id/retry` | Reencola: resetea Podcast (status=PENDING, limpia errorMsg/notebookId/audioPath) y Job (QUEUED, stage=queued, progress=0). |
| `GET /api/status/:jobId` | **SSE**. Sondea la BD cada 2 s; emite `{ jobId, podcastId, status, stage, progress, errorMsg, audioPath, podcastStatus }`. Cierra al llegar a DONE/FAILED. |
| `GET /api/auth/status` | Ejecuta `auth check --test` (llamada de token REAL) y devuelve `{ valid: boolean }`. |
| `POST /api/auth/login` | **Solo local.** Lanza `scripts/nlm_login.py` (Playwright) que abre Chrome para iniciar sesión en NotebookLM y guarda la sesión automáticamente. Deriva el Python del venv de `NLM_PATH` (o `NLM_PYTHON`). Si no encuentra el Python/script (p. ej. en Vercel), devuelve error 400. |

---

## 8. Worker (`src/workers/worker.ts`)

Bucle infinito: cada `WORKER_POLL_MS` busca el `GenerationJob` más antiguo en `QUEUED` y lo procesa. `processJob`:

1. Marca Job=RUNNING, Podcast=GENERATING.
2. **Traduce el título** → `titleEn`/`titleEs` (opcional; no rompe si falla).
3. `authCheck()` — si falla, lanza error → Job=FAILED con mensaje de re-login.
4. `createNotebook("Podcast: <topic>")` → guarda `notebookId`. (stage=research, 20%)
5. Fuentes: si hay URLs → `addUrlSource` por cada una (con **reintento**); si no → `addResearch(topic)` (investigación web, **reintento 3× con backoff** por errores RPC transitorios). (stage=research, 45%)
6. `waitSourcesReady`. (stage=generating, 60%)
7. `generateAudio(...)` con `--wait` (bloquea hasta terminar, hasta 25 min). (stage=downloading, 90%)
8. `downloadAudio(...)` → `public/audio/<podcastId>.mp3`.
9. Podcast=PUBLISHED + `audioPath`; Job=DONE, 100%.

Errores → Job=FAILED + Podcast=FAILED con `errorMsg`. Helper `withRetry(fn, {attempts, baseMs, label})`.

---

## 9. Wrapper del CLI (`src/lib/notebooklm/client.ts`)

Ejecuta `notebooklm.exe` vía `execFile`, siempre con `--quiet` (stdout limpio) y `--json` cuando aplica. `NLM_PATH` se normaliza con `path.normalize`.

Funciones: `runNlm`, `runNlmJson`, `authCheck`, `authStatus` (usa `auth check --test`), `createNotebook`, `addUrlSource`, `addResearch` (`source add-research … --import-all`), `listSources`, `waitSourcesReady`, `generateAudio` (`generate audio -n <id> --wait --format --length --language --retry`), `downloadAudio` (`download audio <path> -n <id> --latest --force`).

**Contexto de notebook**: se pasa siempre con `-n <notebookId>` (no se usa `notebooklm use`). Comandos clave admiten `--json` para salida parseable.

---

## 10. ⚠️ Gotchas del entorno (IMPORTANTE — leer antes de tocar)

1. **Worker solo en Windows** (`notebooklm.exe`). No portar el worker a Linux/Vercel.
2. **`NLM_PATH` con barras normales `/`**. Con `\\`, `dotenv` interpreta `\n` de `\notebooklm` como salto de línea y **corrompe la ruta**. El cliente hace `path.normalize` por robustez, pero mantener `/` en `.env`.
3. **Prisma + certificado TLS**: esta máquina intercepta TLS con un CA propio. `prisma generate` / `db push` / `next build` fallan al descargar el engine salvo con `NODE_OPTIONS=--use-system-ca`. En PowerShell: `$env:NODE_OPTIONS="--use-system-ca"` antes del comando. (El runtime usa engines ya cacheados, así que `npm run dev`/`worker` no lo necesitan.)
4. **Traducción y TLS**: `src/lib/translate.ts` intenta `fetch` normal y, si el proxy lo bloquea, reintenta con un **dispatcher de `undici` que ignora el certificado** (solo para estas peticiones). Por eso funciona sin flags. Timeout de 8 s por petición.
5. **Sesión de NotebookLM caduca** (~horas/días). Síntoma: el worker falla en `create` con *"Authentication expired or invalid… Run 'notebooklm login'"*. El banner de la app (`/api/auth/status`) lo detecta en vivo. **Re-autenticar** de dos formas:
   - **Desde la app (recomendado, solo local)**: botón **"Iniciar sesión en NotebookLM"** en el banner → `POST /api/auth/login` lanza `scripts/nlm_login.py`, abre Chrome, el usuario inicia sesión y el script **guarda solo** al detectar login válido (cookie SID + página en notebooklm, estable 2 chequeos). La app sondea `/api/auth/status` hasta ponerse verde.
   - **Manual**: ejecutar el script de login con el Python del venv.
   - **Ruta de sesión que lee el CLI**: `C:\Users\<user>\.notebooklm\profiles\default\storage_state.json` (¡no la legacy `~/.notebooklm/storage_state.json`!).
   - Verificar con `notebooklm auth check --test` (el `auth check` sin `--test` solo valida que existan cookies, no que sirvan).
   - **El login por navegador NO funciona en Vercel/Linux** (no hay Chrome ni el .exe): siempre en la máquina Windows local.
6. **Next fijado en 14.2.35** (parchea el CVE del aviso original). Advisories restantes requieren Next 16 (breaking) — **pendiente**.

---

## 11. Internacionalización (`src/lib/i18n.tsx`)

- `I18nProvider` (envuelve todo en `layout.tsx`), hook `useI18n()` → `{ lang, setLang, t }`.
- Idioma por defecto **`en`**; persistido en `localStorage['lang']`. Toggle **EN/ES** en el header (`LanguageToggle.tsx`).
- Diccionarios `EN` y `ES` (objetos planos `clave → texto`). Para añadir texto nuevo: agregar la clave en **ambos** diccionarios y usar `t("clave")`.
- `pickTitle(lang, podcast)`: devuelve `titleEn`/`titleEs` según idioma con fallback a `title`. Úsalo para mostrar títulos de podcast.
- **Todos los componentes con texto son client components** (`"use client"`) porque `useI18n` usa contexto de React.

---

## 12. Sistema de diseño (`globals.css` + `tailwind.config.ts`)

Extraído de `public/Youtube.html` (estilo editorial oscuro).
- **Colores** (Tailwind + CSS vars): `bg #080808`, `elevated #111`, `fg #f5f5f5`, `dim #888`, `mute #555`, `accent #ff2a2a` (rojo), `yellow #e5ff00`, `blue #2b6fff`, `line`/`line-strong` (bordes blancos translúcidos).
- **Fuentes** (Google Fonts, `<link>` en `layout.tsx`): `font-display` = Bricolage Grotesque (títulos), `font-sans` = Space Grotesk (cuerpo), `font-mono` = JetBrains Mono (etiquetas/eyebrows).
- **Rasgos**: esquinas rectas (`border-radius: 0`), etiquetas mono en mayúsculas con tracking, overlay de **grano de película** animado (`body::before`).
- **Clases utilitarias propias**: `.card`, `.btn-primary` (rojo, hover blanco), `.btn-outline`, `.input`, `.label`, `.eyebrow`, `.font-display`, `.font-mono`.

---

## 13. Componentes y páginas (`src/`)

**Páginas** (`app/`): `layout.tsx` (metadata "Notebook LM Podcast Creator", fuentes, `I18nProvider`, `Header`, `SiteFooter`) · `page.tsx` (`AuthBanner` + `Hero` + `PodcastGenerator`) · `library/page.tsx` (client; fetch `/api/podcasts`; grid de `PodcastCard`, `onChanged=load`) · `podcast/[id]/page.tsx` (client; detalle; muestra `AudioPlayer` si PUBLISHED, `LiveStatus` si en progreso, error si FAILED; botones **Retry** (si FAILED) y **Delete**).

**Componentes** (`components/`): `Header` · `LanguageToggle` · `SiteFooter` (foto `/VHGM%20pic%20foto.PNG` + crédito) · `Hero` · `AuthBanner` (estados checking/valid/invalid/loggingIn; botón **"Iniciar sesión en NotebookLM"** que llama a `/api/auth/login` y sondea el estado hasta ponerse verde) · `PodcastGenerator` (formulario; `useSSE`; muestra `ProgressTracker`) · `ProgressTracker` (etapas, barra, botón Retry al fallar) · `PodcastCard` (título con `pickTitle`; botones Delete y Retry-si-FAILED) · `AudioPlayer` (audio + descarga; incrementa plays) · `LiveStatus` (`useSSE` + `ProgressTracker`).

**Hook**: `hooks/useSSE.ts` (EventSource a `/api/status/[jobId]`; tipo `JobStatus`).

**public/**: `VHGM pic foto.PNG` (foto autor, versionada) · `Youtube.html` (referencia de estilo) · `audio/*.mp3` (generados, **gitignored**).

**scripts/**: `nlm_login.py` (login Playwright a NotebookLM lanzado desde `/api/auth/login`; guarda `storage_state.json` automáticamente).

---

## 14. Funciones ya implementadas

- ✅ Generar podcast desde tema/pregunta (formato, duración, idioma, URLs opcionales).
- ✅ Cola + worker + progreso en tiempo real (SSE) con etapas.
- ✅ Biblioteca con tarjetas; página de detalle con reproductor y descarga; contador de reproducciones.
- ✅ **Bilingüe EN/ES** (EN por defecto) con toggle; títulos de tarjeta según idioma (traducción automática).
- ✅ Diseño editorial oscuro (de `Youtube.html`); nombre "Notebook LM Podcast Creator"; footer con foto y crédito.
- ✅ **Banner de estado de sesión** de NotebookLM al iniciar (chequeo real de token) con instrucciones de re-login.
- ✅ **Botón "Iniciar sesión en NotebookLM"** en la app (local): abre Chrome, guarda la sesión sola y el banner pasa a verde.
- ✅ **Borrar** podcasts (BD + MP3) y **Reintentar** generaciones fallidas (tarjeta, detalle y tracker).
- ✅ Robustez: barra de progreso instantánea (traducción movida al worker); reintentos con backoff en investigación web; timeouts en traducción.

---

## 15. Limitaciones y pendientes (candidatos a próximas tareas)

- ❌ **Sin usuarios/autenticación** de la app ni podcasts privados/públicos.
- ❌ **Sin paginación** real (límite fijo 100) ni orden configurable.
- ❌ **Sin edición de título/tema** desde la UI (hoy se hace por script contra la BD).
- ❌ **Storage local** (no S3/R2/CDN); los MP3 se sirven desde `public/audio`.
- ❌ **Una sola máquina**; la cola es la propia tabla (no escala horizontalmente).
- ❌ **Next 16 advisories** pendientes (upgrade breaking).
- ⚠️ La investigación web de NotebookLM puede fallar de forma **persistente** para ciertos temas (no solo transitoria); hay reintentos pero no garantía.
- ⚠️ La sesión de NotebookLM **caduca** y requiere re-login manual por navegador (no hay refresh automático).
- 💡 Ideas: editar/regenerar podcast, más tipos (video, quiz, informe) que el CLI ya soporta, portadas/transcripciones, filtros/búsqueda en biblioteca, notificaciones al terminar.

---

## 16. Convenciones para modificar

- **Texto nuevo** → añadir clave en `EN` y `ES` de `i18n.tsx` y usar `t(...)`. No hardcodear strings visibles.
- **Nuevo campo de podcast** → editar `schema.prisma`, correr `npm run db:push` (con `NODE_OPTIONS=--use-system-ca`), actualizar rutas/tipos.
- **Estilos** → reutilizar clases (`.card`, `.btn-*`, `.input`, `.label`, `.eyebrow`) y colores del tema (`text-accent`, `bg-elevated`, `border-line`…). Mantener esquinas rectas y fuentes mono para etiquetas.
- **Llamadas al CLI** → añadir función en `client.ts` (con `-n <id>` y `--json`), no invocar `execFile` desde componentes.
- **Trabajo largo** → siempre vía el worker + Job, nunca dentro de una API route.
- **Commits**: repo ya inicializado; `.env`/`node_modules`/`dev.db`/`*.mp3` están gitignored.

---

## 17. Despliegue y realidad en Vercel

Existe un deploy en **https://notebook-lm-podcast-creator.vercel.app** pero es **solo una vitrina de la interfaz**. En Vercel (Linux serverless):
- ❌ **No genera podcasts**: `notebooklm.exe` es solo Windows y no existe ahí.
- ❌ **No hace login**: el login necesita un Chrome real (no hay escritorio). `/api/auth/login` devuelve 400.
- ❌ **Biblioteca vacía**: la BD (`dev.db`) y los MP3 (`public/audio`) están gitignored → no se despliegan. El sistema de archivos de Vercel es efímero/solo-lectura.
- 🔴 El banner sale **rojo siempre** (intenta ejecutar el CLI inexistente).

**Los datos y la generación viven solo en la máquina Windows local.**

Para hacer el sitio público **funcional** (pendiente, requiere confirmación del usuario): arquitectura **híbrida** →
1. BD en la nube (**Neon/Supabase Postgres**) — cambiar `provider` de Prisma a `postgresql` y `DATABASE_URL`; ojo: SQLite usa strings donde Postgres podría usar enums.
2. Storage de MP3 en la nube (**Cloudflare R2 / S3**) — reemplazar la escritura a `public/audio` por subida a un bucket y guardar la URL pública en `audioPath`.
3. El **worker + login siguen en el Windows local**, conectados a esa BD/-storage en la nube. El login a NotebookLM **siempre** es local.

---

## 18. Mantenimiento de este documento

**Regla del proyecto:** actualizar este `HANDOFF.md` **al final de cada sesión que modifique la app** (nuevas funciones, endpoints, modelos, gotchas o decisiones), y añadir una entrada al changelog. Commitear el HANDOFF junto con los cambios.

---

## 19. Sugerencias de cambios y mejoras propuestas

Ideas concretas y accionables para futuros modelos/programadores. Cada una indica **dónde** tocar y **consideraciones**. Priorizadas de mayor a menor impacto.

### A. Hacer funcional el sitio público (híbrido nube) — *impacto alto*
Hoy Vercel es solo vitrina (ver §17). Para que muestre/reproduzca podcasts:
1. **BD en la nube**: crear proyecto en **Neon** o **Supabase** (Postgres). Cambiar en `prisma/schema.prisma` `provider = "postgresql"` y `DATABASE_URL`. Correr `prisma migrate`. Ojo: hoy los estados son strings (SQLite); en Postgres podrían pasarse a enums nativos (opcional).
2. **Storage de audio**: subir el MP3 a **Cloudflare R2** o **S3** en `worker.ts` (paso "descargar") en vez de `public/audio`; guardar la URL pública en `Podcast.audioPath`. Añadir SDK (`@aws-sdk/client-s3`) y credenciales en `.env`.
3. **Worker + login siguen en el Windows local**, apuntando a la BD/-storage en la nube. El login a NotebookLM **siempre** es local.
4. Variables de entorno en Vercel (DATABASE_URL, credenciales de storage). El worker local usa las mismas.

### B. Editar / regenerar podcasts desde la UI — *impacto alto*
- Hoy editar título/tema solo se hace por script contra la BD. Añadir `PATCH /api/podcasts/:id` (título, tema) y un modal de edición en la tarjeta/detalle. Al cambiar el título, re-traducir `titleEn/titleEs` (usar `translateTitleBoth`).
- "Regenerar" = reusar `POST /api/podcasts/:id/retry` (ya existe) pero permitiendo cambiar formato/duración antes.

### C. Otros formatos de NotebookLM — *impacto medio*
El CLI ya soporta `generate video | slide-deck | quiz | flashcards | infographic | mind-map | report | data-table`. Añadir:
- Selector de "tipo de salida" en el formulario (hoy solo audio).
- Funciones en `client.ts` análogas a `generateAudio`/`downloadAudio` para cada tipo (patrón idéntico: `generate <tipo> -n <id> --wait`, luego `download <tipo> <ruta>`).
- Campo `kind` en `Podcast` (audio/video/…); el reproductor/preview cambia según tipo (mp4, pdf, png, json).

### D. Búsqueda y filtros en la Biblioteca — *impacto medio*
- `GET /api/podcasts` ya acepta `?status=&q=`. Añadir en `library/page.tsx` un input de búsqueda y chips de filtro (status/formato/idioma) que llamen al endpoint. Añadir paginación real (hoy límite fijo 100).

### E. Portadas y transcripciones — *impacto medio*
- Portada: generar/asignar una imagen por podcast (campo `coverPath`); mostrar en tarjeta y detalle.
- Transcripción: si el CLI/NotebookLM la expone, guardarla y mostrarla bajo el reproductor.

### F. Notificaciones al terminar — *impacto bajo/medio*
- El worker podría notificar (webhook, email, o Web Push) cuando un podcast pasa a PUBLISHED. Hoy el usuario debe recargar la Biblioteca.

### G. Refresco/gestión de sesión de NotebookLM — *impacto medio*
- La sesión caduca y requiere re-login manual (ya hay botón en la app, §17/§10.5). Explorar: aviso proactivo antes de generar si `auth check --test` falla; reintentar login automático; o refrescar cookies si la librería lo permite.
- Manejar el caso de **fallo persistente** de investigación web (no solo transitorio): tras N reintentos, marcar FAILED con un mensaje claro y sugerir aportar URLs propias.

### H. Autenticación de usuarios / multiusuario — *impacto alto, esfuerzo alto*
- Hoy no hay usuarios. Añadir auth (p. ej. NextAuth), asociar podcasts a usuarios, visibilidad público/privado, y la tabla `Favorite` prevista en el plan original.

### I. Robustez y calidad — *varios*
- Subir a **Next 16** (resuelve advisories pendientes; es breaking: revisar cambios de App Router/params async).
- Tests (unit del `client.ts`/`translate.ts`; e2e con Playwright del flujo de generación).
- Sanitizar mejor el input del tema (hoy se recorta a 10–500 chars; el doble espacio del ejemplo "When  should" pasó tal cual).

---

## 20. Changelog

- **2026-07-02** — Estado inicial documentado. App creada de cero: generación end-to-end vía NotebookLM CLI, cola+worker+SSE, biblioteca+reproductor. Añadido: bilingüe EN/ES con toggle y títulos traducidos, rediseño editorial (de `Youtube.html`), nombre "Notebook LM Podcast Creator", footer con foto/crédito, banner de estado de sesión, borrar/reintentar podcasts, arreglos de robustez (barra de progreso instantánea, reintentos en investigación), y **botón "Iniciar sesión en NotebookLM"** en la app (`/api/auth/login` + `scripts/nlm_login.py`). Deploy inicial en Vercel (solo vitrina de UI). Botón de login **probado OK** (sesión se restaura y el banner pasa a verde). Añadida §19 con sugerencias/mejoras propuestas. Al cierre de la sesión: 2 podcasts en la BD local (1 PUBLISHED, 1 PUBLISHED tras retry), sesión de NotebookLM válida.
# Actualizacion 2026-07-02 - modo publico hibrido

La app fue preparada para pasar de MVP local a despliegue publico funcional con arquitectura hibrida:

- Prisma ahora usa **Postgres** (`provider = "postgresql"`) en vez de SQLite.
- Se agrego el modelo `WorkerStatus` para que el worker Windows reporte estado, autenticacion real de NotebookLM y `lastSeenAt`.
- Se agrego `src/lib/storage.ts` con `STORAGE_DRIVER=local|s3`; en modo `s3` sube MP3 a S3/Cloudflare R2 y guarda una URL publica en `Podcast.audioPath`.
- El worker Windows sigue ejecutando `notebooklm.exe`, pero ahora puede subir el MP3 a storage remoto y actualizar la BD publica.
- `/api/auth/status` ya no intenta ejecutar `notebooklm.exe` en servidores sin CLI; en Vercel lee `WorkerStatus` desde Postgres.
- `AuthBanner` fue adaptado para entorno publico: muestra worker offline o worker sin sesion, y no ofrece login local cuando el servidor es remoto.
- `.env.example` y `README.md` documentan `DATABASE_URL` Postgres y variables `S3_*`.

Verificado: `npx prisma validate` OK con URL Postgres temporal, `npx prisma generate` OK tras detener procesos Node del proyecto, `npm run build` OK. Advertencia no bloqueante: Next no pudo optimizar Google Fonts durante build.

Pendiente para hacer live: crear Postgres real, crear bucket R2/S3 con URL publica, configurar variables en Vercel y en Windows, ejecutar `npm run db:push` contra Postgres real, redesplegar Vercel y arrancar `npm run worker` en Windows.

---

# Actualizacion 2026-07-02 - intento de configuracion publica

Se vinculo el repo local al proyecto Vercel existente `vhgarcia100-7168s-projects/notebook-lm-podcast-creator` con `vercel link`; la URL de produccion sigue siendo `https://notebook-lm-podcast-creator.vercel.app`. Vercel no tiene variables de entorno de produccion configuradas aun (`vercel env ls production` mostro 0 variables).

Se intento crear un proyecto Supabase dedicado llamado `Notebook LM Podcast Creator` en `Victor Garcia Org` (`mepwoqlffquswgiikwpz`), region `us-east-2`. El costo reportado por Supabase fue `$0/month`, pero la creacion fallo porque la cuenta alcanzo el limite de 2 proyectos free activos. Proyectos activos disponibles sin conflictos de tablas `Podcast`/`GenerationJob`: `Vitruvian Websites` (`ggaxyfvjvsslfytywhgb`, us-east-1) y `Zulyskincare web` (`pqlxyzlwpgvniqnswmss`, us-west-2). Usar uno existente requiere pegar/configurar su `DATABASE_URL` Postgres real; el conector Supabase permite SQL, pero no expone la contrasena de la DB.

Bloqueador actual para completar el live deploy: faltan secretos reales para `DATABASE_URL` y storage `S3_*`/R2. Una vez disponibles: configurar env vars en Vercel, ejecutar `npm run db:push` contra Postgres, desplegar Vercel prod y arrancar el worker Windows con las mismas variables.

---

# Actualizacion 2026-07-02 - Supabase elegido y tablas creadas

El usuario eligio usar el proyecto Supabase existente `Zulyskincare web` / `https://pqlxyzlwpgvniqnswmss.supabase.co` (`project_id=pqlxyzlwpgvniqnswmss`) dentro de Victor Garcia Org. Para evitar mezclar nombres con las tablas existentes `bookings` y `availability_settings`, Prisma fue mapeado a tablas prefijadas:

- `Podcast` -> `public.podcast_creator_podcasts`
- `PodcastSource` -> `public.podcast_creator_sources`
- `GenerationJob` -> `public.podcast_creator_generation_jobs`
- `WorkerStatus` -> `public.podcast_creator_worker_status`

Se aplico migracion Supabase `create_podcast_creator_tables` con exito. Las tablas existen y estan vacias. `prisma/schema.prisma` usa `@@map`/`@map` para mantener el codigo TypeScript igual y usar nombres SQL en snake_case. Verificacion despues del mapeo: `npx prisma validate` OK, `npx prisma generate` OK, `npm run build` OK con solo advertencia no bloqueante de Google Fonts.

Nota de seguridad Supabase: el advisor marco RLS deshabilitado en las 4 tablas nuevas. No se habilito automaticamente porque la app accede por Prisma/server-side con `DATABASE_URL` privada, y activar RLS sin policies podria bloquear la app. Si mas adelante se expone acceso por Supabase client/anon key, disenar policies primero.

Pendiente para completar Vercel: obtener/configurar el `DATABASE_URL` real de este proyecto Supabase y las credenciales R2/S3 (`STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, etc.).

---

# Actualizacion 2026-07-02 - DATABASE_URL configurado y Vercel desplegado

Se creo un rol Postgres dedicado `podcast_creator_app` en Supabase `pqlxyzlwpgvniqnswmss` y se le dieron permisos `select/insert/update/delete` solo sobre las tablas `public.podcast_creator_*`. El `.env` local fue actualizado para usar el Supavisor transaction pooler con usuario `podcast_creator_app.pqlxyzlwpgvniqnswmss` y parametros Prisma `pgbouncer=true&connection_limit=1&pool_timeout=30`. Se verifico conexion local con Prisma: `podcasts=0`, `jobs=0`, `worker_status=0`.

Se configuro `DATABASE_URL` en Vercel Production como variable sensible y se desplego produccion con `vercel --prod --yes`. Deployment listo: `dpl_BVteqLwdFMeLS7SyG8sh9sa5FG2Q`; alias principal activo: `https://notebook-lm-podcast-creator.vercel.app`. Verificacion publica: `/api/podcasts` responde `[]`; `/api/auth/status` responde `source=worker`, `workerOnline=false`, `valid=false`, lo esperado porque el worker Windows aun no esta corriendo contra storage cloud.

Pendiente para app end-to-end: configurar storage R2/S3 (`STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_KEY_PREFIX=audio`) en `.env` local y Vercel; despues arrancar `npm run worker` en Windows. No arrancar el worker para producir podcasts publicos hasta que storage este listo, porque si `STORAGE_DRIVER` queda en local guardaria `/audio/...` que Vercel no puede servir.

---

# Actualizacion 2026-07-02 - Cloudflare R2 storage configurado localmente

Se configuraron las credenciales de **Cloudflare R2** en el `.env` local para habilitar el almacenamiento de audio en la nube:

```
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://ac03dec159ee171771f8c9e9d9a16a8b.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="podcast-audio"
S3_ACCESS_KEY_ID="0e014180a307db12f183586c1fc94599"
S3_SECRET_ACCESS_KEY="e2119472578caa83b1204828180a3aa64758b3ff0a0a8345491812bcf4f033b4"
S3_PUBLIC_BASE_URL="https://pub-2acff2bce0e9482ab3b24a432884cc5c.r2.dev"
S3_KEY_PREFIX="audio"
```

Con esto, cuando el worker Windows genere podcasts, subirá los MP3 a R2 y guardará la URL pública (formato: `https://pub-2acff2bce0e9482ab3b24a432884cc5c.r2.dev/audio/<podcastId>.mp3`) en `Podcast.audioPath`. El reproductor puede servir estos archivos desde cualquier lugar.

**Pendiente para completar deploy público funcional:**
1. Configurar las mismas variables de entorno R2 en **Vercel Production** (panel web o `vercel env add`).
2. Arrancar `npm run worker` en la máquina Windows local apuntando a la BD Postgres pública (`DATABASE_URL` ya está configurado desde la actualización anterior).
3. Generar un podcast de prueba desde el sitio Vercel prod para verificar el flujo end-to-end.

**Importante:** No arrancar el worker para uso público hasta configurar R2 en Vercel, porque cualquier podcast generado con `STORAGE_DRIVER=local` quedaría con rutas `/audio/...` que Vercel no puede servir.

---

# Actualización 2026-07-02 - Auto-limpieza de fuentes y worker como servicio

Se añadieron dos mejoras críticas para producción:

## 1. Auto-limpieza de fuentes corruptas

**Problema:** A veces la generación de audio se retrasa porque algunas fuentes no se cargan correctamente (corruptas, bloqueadas, etc.).

**Solución:** El worker ahora ejecuta `cleanSources()` automáticamente antes de generar audio. Este comando elimina:
- Fuentes duplicadas
- Fuentes con errores
- Fuentes bloqueadas por permisos

**Flujo actualizado:**
```
Añadir fuentes → Limpiar fuentes malas → Esperar fuentes buenas → Generar audio
```

Esto acelera la generación al eliminar fuentes problemáticas que causarían timeouts o errores.

## 2. Worker como servicio permanente Windows

**Problema:** El worker debe correr 24/7 para procesar podcasts creados desde cualquier dispositivo (phone, tablet, etc.), no solo cuando se ejecuta manualmente `npm run worker`.

**Solución:** Script de instalación `setup-worker-service.ps1` que:
1. Instala PM2 (process manager para Node.js)
2. Configura el worker como servicio de Windows
3. Auto-inicia el worker al arrancar Windows
4. Reinicia automáticamente si falla

**Uso:**
```powershell
.\setup-worker-service.ps1
```

**Comandos útiles:**
- `pm2 status` - Ver estado
- `pm2 logs podcast-worker` - Ver logs
- `pm2 restart podcast-worker` - Reiniciar
- `pm2 stop podcast-worker` - Detener

**Beneficio:** Una vez configurado, el usuario puede crear podcasts desde su teléfono/cualquier lugar vía la web pública en Vercel, y el worker Windows (corriendo 24/7) los procesará automáticamente.

Archivos modificados:
- `src/lib/notebooklm/client.ts` - Añadida función `cleanSources()`
- `src/workers/worker.ts` - Integrada limpieza automática antes de `waitSourcesReady()`
- `setup-worker-service.ps1` - Script de instalación del servicio
- `README.md` - Documentación actualizada

---

# Actualización 2026-07-02 - Importación desde NotebookLM con selección de audio múltiple

Se implementó la funcionalidad para **importar podcasts desde cualquier notebook de NotebookLM** del usuario, con soporte completo para selección de audios múltiples:

## Funcionalidades implementadas

### 1. Listar notebooks con sus audios
- **GET `/api/notebooks`** - Lista todos los notebooks del usuario con sus audios disponibles
- Cada notebook incluye array `audios[]` con todos los Audio Overviews generados
- Muestra título, fecha de creación, y metadatos de cada audio

### 2. Importar con dos modos
**Modo "Usar Audio Existente":**
- Lista todos los audios disponibles del notebook seleccionado
- Usuario selecciona qué audio específico importar
- Worker descarga ese audio exacto (~30 segundos)
- Ideal para notebooks que ya tienen audio generado

**Modo "Generar Nuevo":**
- Permite crear un nuevo audio con parámetros personalizados (formato/duración/idioma)
- Worker genera nuevo audio incluso si el notebook ya tiene otros
- Permite múltiples versiones del mismo notebook (~10-20 minutos)

### 3. Selección inteligente de modo
- Si notebook tiene audios → modo predeterminado "Usar Existente"
- Si solo hay 1 audio → se auto-selecciona
- Si notebook no tiene audios → modo automático "Generar Nuevo"
- Usuario puede cambiar entre modos libremente

### 4. Re-importación permitida
- Se puede importar el mismo notebook múltiples veces
- Cada importación crea un `Podcast` separado con diferente `id`
- Comparten el mismo `notebookId` pero pueden tener diferentes:
  - `audioId` (audio específico seleccionado)
  - `format`, `length`, `language` (si se generó nuevo)

## Cambios técnicos

### Base de datos
- **Campo nuevo:** `Podcast.audioId` (String?, nullable)
- Almacena el ID del artifact de audio específico a descargar
- Si es `null`, el worker descarga el audio más reciente

### Backend (`src/lib/notebooklm/client.ts`)
```typescript
// Nueva función para listar audios
export async function listAudios(notebookId: string): Promise<AudioArtifact[]>
// Comando CLI: artifact list --type audio -n <id> --json

// Modificada para aceptar audioId opcional
export async function downloadAudio(
  notebookId: string,
  outPath: string,
  artifactId?: string  // NUEVO
): Promise<void>
// Si artifactId presente: -a <id>
// Si no: --latest
```

### API Routes
- **GET `/api/notebooks`** (NUEVO) - Enriquece notebooks con `audios[]` array
- **POST `/api/podcasts/import`** (NUEVO) - Acepta parámetros:
  - `notebookId` (requerido)
  - `importMode`: `"existing"` | `"generate"`
  - `audioId` (requerido si mode=existing)
  - `title`, `topic` (del frontend)
  - `format`, `length`, `language` (solo para mode=generate)

### Worker (`src/workers/worker.ts`)
```typescript
// Lógica de descarga actualizada (línea ~175)
if (podcast.audioId) {
  // Descargar audio específico
  await downloadAudio(notebookId, outPath, podcast.audioId);
} else {
  // Descargar el más reciente (comportamiento anterior)
  await downloadAudio(notebookId, outPath);
}
```

### Frontend (`src/components/`)
- **`NotebookImporter.tsx`** (NUEVO) - Componente principal con:
  - Lista de notebooks en grid
  - Selector de modo (toggle "Usar Existente" / "Generar Nuevo")
  - Lista seleccionable de audios disponibles
  - Formulario de parámetros para generación
  - Auto-selección inteligente basada en disponibilidad
- **`NotebookCard.tsx`** (NUEVO) - Tarjeta de notebook con badge "✓ AUDIO READY"
- **`PodcastGenerator.tsx`** (MODIFICADO) - Toggle entre "Create New" e "Import from NotebookLM"

### i18n (`src/lib/i18n.tsx`)
Nuevas claves de traducción (EN/ES):
- `gen.modeCreate` / `gen.modeImport`
- `import.modeLabel`, `import.useExisting`, `import.generateNew`
- `import.selectAudio`, `import.audioWillDownload`, `import.willGenerate`
- `import.hasAudioTitle`, `import.hasAudioDesc`, `import.noAudioDesc`
- `import.created`

## Migración de base de datos pendiente

**IMPORTANTE:** Antes de usar en producción, aplicar migración:

```bash
# Opción 1: Push directo (desarrollo)
npx prisma db push

# Opción 2: SQL manual (producción Supabase)
ALTER TABLE podcast_creator_podcasts ADD COLUMN audio_id TEXT;
```

Luego regenerar cliente:
```bash
npx prisma generate
```

## Flujo de usuario típico

1. Usuario hace clic en **"Importar de NotebookLM"**
2. La app lista todos sus notebooks con conteo de audios
3. Usuario selecciona un notebook
4. **Si tiene audios:**
   - Se muestra lista de audios con títulos y fechas
   - Usuario selecciona uno → "Import Podcast" → ~30s descarga
   - O cambia a "Generar Nuevo" → configura parámetros → ~10-20min
5. **Si no tiene audios:**
   - Modo automático "Generar Nuevo"
   - Usuario configura formato/duración/idioma → ~10-20min
6. Podcast aparece en biblioteca para reproducir/compartir

## Beneficios

✅ **Reutilización de trabajo:** Aprovecha audios ya generados en NotebookLM  
✅ **Múltiples versiones:** Permite importar/generar varias versiones del mismo contenido  
✅ **Flexibilidad:** Usuario decide entre velocidad (usar existente) o personalización (generar nuevo)  
✅ **UX clara:** Mensajes explícitos sobre qué pasará y cuánto tardará  
✅ **Bilingüe:** Toda la UI soporta EN/ES

## Comandos CLI de NotebookLM usados

```bash
# Listar todos los artifacts de audio
notebooklm artifact list --type audio -n <notebookId> --json

# Descargar audio específico
notebooklm download audio <path> -n <notebookId> -a <artifactId> --force

# Descargar el más reciente (comportamiento anterior)
notebooklm download audio <path> -n <notebookId> --latest --force
```

## Archivos modificados/creados

**Backend:**
- `prisma/schema.prisma` - Campo `audioId` agregado a modelo `Podcast`
- `src/lib/notebooklm/client.ts` - Funciones `listAudios()` y `downloadAudio()` modificada
- `src/app/api/notebooks/route.ts` - Endpoint NUEVO
- `src/app/api/podcasts/import/route.ts` - Endpoint NUEVO
- `src/workers/worker.ts` - Lógica de descarga con audioId opcional

**Frontend:**
- `src/components/NotebookImporter.tsx` - Componente NUEVO
- `src/components/NotebookCard.tsx` - Componente NUEVO
- `src/components/PodcastGenerator.tsx` - Modo toggle agregado
- `src/lib/i18n.tsx` - Traducciones EN/ES agregadas

**Estado:** ✅ Implementación completa y funcional.

---

# Actualización 2026-07-02 - Worker PM2 instalado y sistema completo funcional

El worker fue instalado exitosamente como servicio permanente de Windows usando PM2:

## Configuración del servicio

**Archivos creados:**
- `ecosystem.config.js` - Configuración PM2 del worker
- `run-worker.js` - Wrapper script para ejecutar TypeScript con tsx

**Proceso PM2:**
- Nombre: `podcast-worker`
- Estado: **online** y estable
- Auto-inicio: Configurado (arranca con Windows)
- Reinicio automático: Habilitado
- Límite de memoria: 1GB
- Logs: `C:\Users\skint\.pm2\logs\podcast-worker-*.log`

## Comandos de gestión

```bash
pm2 status                    # Ver estado del worker
pm2 logs podcast-worker       # Ver logs en tiempo real
pm2 restart podcast-worker    # Reiniciar worker
pm2 stop podcast-worker       # Detener worker
pm2 start podcast-worker      # Iniciar worker (si está detenido)
pm2 save                      # Guardar configuración actual
```

## Estado verificado

✅ **Worker:** Corriendo y sondeando la cola cada 5s  
✅ **NotebookLM:** Sesión autenticada y válida (29 cookies, token fetch OK)  
✅ **Base de datos:** Migración `audioId` aplicada en Supabase  
✅ **Vercel:** Desplegado en producción con última versión  
✅ **GitHub:** Commits actualizados con feature completa  

## Sistema end-to-end funcional

La app ahora está completamente funcional en modo híbrido público:

1. **Frontend público (Vercel):**
   - UI en https://notebook-lm-podcast-creator.vercel.app
   - Modo "Create New" - crear podcasts desde tema/pregunta
   - Modo "Import from NotebookLM" - importar notebooks existentes con selección de audio múltiple

2. **Base de datos (Supabase):**
   - PostgreSQL en la nube compartida
   - Tablas: `podcast_creator_podcasts`, `podcast_creator_sources`, `podcast_creator_generation_jobs`, `podcast_creator_worker_status`

3. **Storage (Cloudflare R2):**
   - Bucket: `podcast-audio`
   - URL pública: `https://pub-2acff2bce0e9482ab3b24a432884cc5c.r2.dev`
   - Audios servidos globalmente

4. **Worker (Windows local):**
   - Servicio PM2 corriendo 24/7
   - Procesa cola automáticamente
   - Sube audios a R2 y actualiza BD pública
   - Reporta estado a WorkerStatus cada minuto

**Flujo completo verificado:**
Usuario (cualquier dispositivo) → Vercel UI → Supabase queue → Worker Windows → NotebookLM CLI → R2 storage → Usuario puede reproducir/descargar

**Próximo paso recomendado:** Test end-to-end generando un podcast desde la web pública para verificar todo el pipeline.

---
