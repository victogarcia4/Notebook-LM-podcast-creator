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

```bash
npm install                 # instala deps (postinstall corre prisma generate)
npm run db:push             # crea/actualiza SQLite (prisma/dev.db)
npm run worker              # TERMINAL 1: worker (dejar abierto)
npm run dev                 # TERMINAL 2: web en http://localhost:3000
```

Requisitos previos: `notebooklm.exe` instalado y **autenticado** (ver §9).

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
5. **Sesión de NotebookLM caduca** (~horas/días). Síntoma: el worker falla en `create` con *"Authentication expired or invalid… Run 'notebooklm login'"*. El banner de la app (`/api/auth/status`) lo detecta en vivo. **Re-autenticar** con el flujo Playwright:
   - Script que abre Chrome persistente, el usuario inicia sesión en `notebooklm.google.com`, y al recibir una señal (`%TEMP%/nlm_save_signal`) guarda `storage_state.json`.
   - **Ruta de sesión que lee el CLI**: `C:\Users\<user>\.notebooklm\profiles\default\storage_state.json` (¡no la legacy `~/.notebooklm/storage_state.json`!).
   - Verificar con `notebooklm auth check --test` (el `auth check` sin `--test` solo valida que existan cookies, no que sirvan).
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

**Componentes** (`components/`): `Header` · `LanguageToggle` · `SiteFooter` (foto `/VHGM%20pic%20foto.PNG` + crédito) · `Hero` · `AuthBanner` (estados checking/valid/invalid con instrucciones de re-login) · `PodcastGenerator` (formulario; `useSSE`; muestra `ProgressTracker`) · `ProgressTracker` (etapas, barra, botón Retry al fallar) · `PodcastCard` (título con `pickTitle`; botones Delete y Retry-si-FAILED) · `AudioPlayer` (audio + descarga; incrementa plays) · `LiveStatus` (`useSSE` + `ProgressTracker`).

**Hook**: `hooks/useSSE.ts` (EventSource a `/api/status/[jobId]`; tipo `JobStatus`).

**public/**: `VHGM pic foto.PNG` (foto autor, versionada) · `Youtube.html` (referencia de estilo) · `audio/*.mp3` (generados, **gitignored**).

---

## 14. Funciones ya implementadas

- ✅ Generar podcast desde tema/pregunta (formato, duración, idioma, URLs opcionales).
- ✅ Cola + worker + progreso en tiempo real (SSE) con etapas.
- ✅ Biblioteca con tarjetas; página de detalle con reproductor y descarga; contador de reproducciones.
- ✅ **Bilingüe EN/ES** (EN por defecto) con toggle; títulos de tarjeta según idioma (traducción automática).
- ✅ Diseño editorial oscuro (de `Youtube.html`); nombre "Notebook LM Podcast Creator"; footer con foto y crédito.
- ✅ **Banner de estado de sesión** de NotebookLM al iniciar (chequeo real de token) con instrucciones de re-login.
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
