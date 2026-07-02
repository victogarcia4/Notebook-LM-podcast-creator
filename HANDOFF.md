# 🧭 HANDOFF — Notebook LM Podcast Creator

> Documento de traspaso. Describe **con exactitud** el estado actual de la aplicación para que otro modelo/desarrollador pueda añadir o modificar funciones sin re-descubrir nada. Última actualización: **2026-07-02 18:00**.

---

## ESTADO FINAL DEL PROYECTO (2026-07-02 18:00)

### ✅ Sistema Funcional Confirmado

**Verificación exitosa:**
- Podcast generándose correctamente (60% completado, etapa "Generating audio")
- Worker PM2 corriendo estable
- NotebookLM autenticado
- SSL fix aplicado y funcionando
- Import feature con manual ID funcionando
- Deployment en Vercel actualizado

### Últimos Fixes Aplicados (2026-07-02)

**1. Import Feature - Manual Notebook ID**
- **Problema:** Import solo funcionaba en localhost (requiere CLI access)
- **Solución:** Modo dual implementado:
  - **Localhost:** Lista visual completa de notebooks con detección de audios
  - **Producción (Vercel):** Input manual de Notebook ID copiado desde NotebookLM URL
- **Archivos modificados:**
  - `src/components/NotebookImporter.tsx` - Lógica dual localhost/production
  - `src/components/PodcastGenerator.tsx` - Toggle siempre visible
  - `src/app/api/notebooks/route.ts` - Marcado como `force-dynamic`
  - `src/app/api/podcasts/import/route.ts` - Marcado como `force-dynamic`
- **Commits:**
  - `86b8e9e` - Add manual import by Notebook ID for production
  - `bac78b4` - Fix: manual import form not showing in production (reordered if statements)

**2. SSL Certificate Fix**
- **Problema:** Worker fallaba con "unable to verify the first certificate"
- **Error ocurría en:** Requests HTTPS a Supabase, R2, NotebookLM APIs
- **Solución:** Agregado `NODE_OPTIONS='--use-system-ca'` al spawn del worker
- **Archivo modificado:** `run-worker.js` - Env var en spawn options
- **Commit:** `25e51d8` - Fix SSL certificate verification error in worker
- **Comando para aplicar:** `pm2 restart podcast-worker`

**3. Authentication Flow**
- **Problema:** Error de auth en import no mostraba botón de login
- **Solución:** Botón "→ LOGIN TO NOTEBOOKLM" agregado en errores de auth
- **Archivo modificado:** `src/components/NotebookImporter.tsx` - handleLogin + polling
- **Commit:** `b59384f` - Add NotebookLM login button to import error screen

### Configuración del Worker PM2

```javascript
// ecosystem.config.js
{
  name: 'podcast-worker',
  script: 'run-worker.js',
  cwd: 'C:\\Users\\skint\\Desktop\\Podcast Creator',
  autorestart: true,
  watch: false,
  max_memory_restart: '1G',
  env: { NODE_ENV: 'production' }
}
```

```javascript
// run-worker.js con SSL fix
spawn('npx', ['tsx', 'src/workers/worker.ts'], {
  env: {
    ...process.env,
    NODE_OPTIONS: '--use-system-ca'  // ← SSL FIX
  }
})
```

### Deployment Status

**GitHub:** https://github.com/victogarcia4/Notebook-LM-podcast-creator
- Branch: `main`
- Último commit: `25e51d8` - Fix SSL certificate verification error in worker
- Estado: Sincronizado con Vercel

**Vercel:** https://notebook-lm-podcast-creator.vercel.app
- Deployment: Activo y actualizado
- Último deploy: 2026-07-02 ~17:51
- Build: ✓ Exitoso (commit `bac78b4` o posterior)

**Worker (Windows local):**
- PM2 Process ID: 1
- Estado: `online`
- Reintentos: 6 (normal debido a fixes aplicados)
- PID actual: ~35188
- Memoria: ~61.9MB
- Comando para verificar: `pm2 status`
- Logs: `pm2 logs podcast-worker`

### Funcionalidades Implementadas

**CREATE NEW (Funciona en localhost y producción):**
1. Usuario ingresa topic/pregunta
2. Opciones: formato, duración, idioma
3. (Opcional) URLs de fuentes específicas
4. Frontend → Vercel API → Supabase queue
5. Worker procesa → NotebookLM CLI → R2 storage
6. Resultado en Library

**IMPORT FROM NOTEBOOKLM:**

**Modo localhost (lista visual):**
1. Click "IMPORT FROM NOTEBOOKLM"
2. Lista visual de notebooks con badges de audio
3. Seleccionar notebook
4. Modo automático: "Use existing" si tiene audio, "Generate new" si no
5. Para existing: selector de audios específicos con fecha
6. Para generate: opciones de formato/duración/idioma
7. Import → worker procesa

**Modo producción (manual ID):**
1. Click "IMPORT FROM NOTEBOOKLM"
2. Instrucciones de cómo conseguir el ID
3. Copiar ID desde URL de NotebookLM: `notebooklm.google.com/notebook/YOUR_ID_HERE`
4. Pegar en input "Notebook ID"
5. (Opcional) Título personalizado
6. Seleccionar formato/duración/idioma
7. Import → worker procesa (siempre modo "generate")

### Variables de Entorno Requeridas

**.env (local):**
```bash
DATABASE_URL="postgresql://..."  # Supabase
NLM_PATH="C:/Users/skint/.notebooklm-venv/Scripts/notebooklm.exe"
AUDIO_DIR="public/audio"
WORKER_POLL_MS="5000"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="podcast-audio"
R2_PUBLIC_URL="https://pub-2acff2bce0e9482ab3b24a432884cc5c.r2.dev"
STORAGE_DRIVER="s3"  # Para usar R2 en producción
```

**Vercel Environment Variables:**
- Todas las variables excepto `NLM_PATH` y `AUDIO_DIR`
- `STORAGE_DRIVER="s3"` configurado en Vercel Production

### Known Issues & Limitations

**1. NotebookLM CLI solo en Windows**
- El worker DEBE correr en Windows
- No se puede deployar el worker en Vercel/cloud
- Solución actual: Worker local + PM2 service

**2. Import desde producción requiere copiar ID manualmente**
- No hay lista visual en producción (requiere CLI)
- Usuario debe ir a NotebookLM → copiar ID → pegar
- Localhost tiene lista visual completa

**3. SSL Certificates en Windows**
- Algunos ambientes Windows no confían en certificates por defecto
- Fix: `NODE_OPTIONS='--use-system-ca'` en worker
- Alternativa insegura (NO usar): `NODE_TLS_REJECT_UNAUTHORIZED=0`

**4. Procesamiento lento**
- Generación de audio: 10-20 minutos típico
- Download de audio existente: ~30 segundos
- No hay forma de acelerarlo (límite de NotebookLM)

### Comandos de Gestión

**Worker:**
```bash
pm2 status                      # Ver estado
pm2 logs podcast-worker         # Ver logs en tiempo real
pm2 restart podcast-worker      # Reiniciar (aplicar cambios)
pm2 stop podcast-worker         # Detener
pm2 start podcast-worker        # Iniciar
pm2 save                        # Guardar config
```

**Database:**
```bash
npm run db:push                 # Aplicar schema a Supabase
```

**Deployment:**
```bash
git add .
git commit -m "mensaje"
git push origin main           # Auto-deploy en Vercel
```

### Testing Recommendations

**Test completo end-to-end:**
1. Ir a https://notebook-lm-podcast-creator.vercel.app
2. Modo CREATE NEW:
   - Ingresar un topic
   - Esperar generación (~15 min)
   - Verificar aparece en Library
   - Reproducir audio
3. Modo IMPORT (manual ID):
   - Ir a https://notebooklm.google.com
   - Abrir un notebook (bajo "My notebooks")
   - Copiar ID de URL
   - Volver a app → pegar ID
   - Importar
   - Esperar procesamiento
   - Verificar en Library

**Verificar worker:**
```bash
pm2 logs podcast-worker --lines 50
```

Buscar:
- `✓ Auth status: VÁLIDO`
- `✓ WorkerStatus actualizado en BD`
- `Procesando podcast`
- Sin errores de SSL

---

## 1. Qué es la app

Aplicación web que genera **podcasts** automáticamente con **Google NotebookLM** a partir de un tema o pregunta escrito por el usuario, y los publica en una biblioteca para escucharlos/descargarlos.

Flujo end-to-end: el usuario escribe un tema → se encola un job → un **worker** ejecuta el CLI `notebooklm.exe` (crear notebook → investigar en la web → generar audio → descargar MP3) → el podcast queda **publicado** y reproducible.

- **Repo:** https://github.com/victogarcia4/Notebook-LM-podcast-creator
- **Ubicación local:** `C:\Users\skint\Desktop\Podcast Creator`
- **Autor / footer:** "Built by Dr. Victor Garcia M"

---

## 2. Arquitectura (Hybrid Cloud)

```
Navegador ──HTTP / SSE──▶ Next.js (Vercel) ──▶ PostgreSQL (Supabase)
                                                     ▲
                   Worker Windows (PM2 local) ───────┘  (polling)
                            │
                            ▼
                   notebooklm.exe CLI
                            │
                            ▼
                   Cloudflare R2 (audio storage)
```

- **Frontend + API**: Next.js 14 (App Router) desplegado en Vercel
- **Database**: PostgreSQL en Supabase (compartida)
- **Worker**: Proceso Node local en Windows con PM2 (servicio permanente)
- **Storage**: Cloudflare R2 para audios (público)
- **Cola**: Tabla `GenerationJob` en PostgreSQL

> ⚠️ **El worker DEBE correr en Windows** porque `notebooklm.exe` solo existe en Windows.

---

## 3. Stack y versiones

| Área | Tecnología |
|------|------------|
| Framework | Next.js **14.2.35** (App Router), React 18, TypeScript 5 |
| Estilos | Tailwind CSS 3 (config propia) + CSS global |
| BD / ORM | PostgreSQL (Supabase) + Prisma **5.22** |
| Worker | `tsx` (ejecuta TypeScript directo); `npx tsx src/workers/worker.ts` |
| CLI IA | `notebooklm-py` v0.3.4 (`notebooklm.exe`), invocado con `child_process.execFile` |
| Storage | Cloudflare R2 (S3-compatible) |
| Process Manager | PM2 (worker como servicio Windows) |
| Traducción | Endpoint gratuito Google gtx (sin clave) + `undici` (fallback TLS) |
| Node | 20+ (probado en Node 24) |

---

## 4. Cómo ejecutar

> ⚠️ **Ejecutar dentro de la carpeta del proyecto** `C:\Users\skint\Desktop\Podcast Creator`

```bash
cd "C:\Users\skint\Desktop\Podcast Creator"
npm install                 # instala deps (postinstall corre prisma generate)
npm run db:push             # aplica schema a Supabase
npm run dev                 # web en http://localhost:3000
```

**Worker (gestión con PM2):**
```bash
pm2 status                      # Ver si está corriendo
pm2 restart podcast-worker      # Reiniciar worker
pm2 logs podcast-worker         # Ver logs
```

Requisitos previos:
- `notebooklm.exe` instalado y autenticado
- PM2 instalado globalmente: `npm install -g pm2`
- Variables de entorno en `.env`

---

## 5. Variables de entorno (`.env`)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `DATABASE_URL` | Conexión PostgreSQL (Supabase) | `postgresql://...` |
| `NLM_PATH` | Ruta al `notebooklm.exe` **con barras normales `/`** | `C:/Users/skint/.notebooklm-venv/Scripts/notebooklm.exe` |
| `AUDIO_DIR` | Carpeta temporal de MP3s | `public/audio` |
| `WORKER_POLL_MS` | Intervalo de sondeo del worker (ms) | `5000` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | — |
| `R2_ACCESS_KEY_ID` | R2 access key | — |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | — |
| `R2_BUCKET_NAME` | Nombre del bucket | `podcast-audio` |
| `R2_PUBLIC_URL` | URL pública del bucket | `https://pub-...r2.dev` |
| `STORAGE_DRIVER` | `local` o `s3` (R2) | `local` (dev), `s3` (prod) |

`.env` está **gitignored**; se versiona `.env.example`.

---

## 6. Modelo de datos (`prisma/schema.prisma`)

PostgreSQL → los "enums" usan tipos nativos.

### `Podcast`
`id, title, titleEn?, titleEs?, topic, format, length, language, status, notebookId?, audioId?, audioPath?, durationSec?, plays, errorMsg?, createdAt, updatedAt` + relaciones `sources[]`, `job?`.
- `status`: `PENDING | GENERATING | PUBLISHED | FAILED`
- `format`: `deep-dive | brief | critique | debate`
- `length`: `short | default | long`
- `language`: código idioma del **audio** (`en`, `es`, `pt`, `fr`, …)
- `titleEn` / `titleEs`: título traducido para mostrar en tarjeta según el toggle
- `audioPath`: URL pública tipo `https://pub-...r2.dev/abc123.mp3`
- `audioId`: ID del artifact de audio específico a descargar (para import)
- `notebookId`: ID del notebook de NotebookLM

### `PodcastSource`
`id, podcastId, kind (url|research), value, createdAt`. `onDelete: Cascade`.

### `GenerationJob`
`id, podcastId (unique), status, stage, progress, errorMsg?, attempts, createdAt, updatedAt`. `onDelete: Cascade`.
- `status`: `QUEUED | RUNNING | DONE | FAILED`
- `stage`: `queued | created | research | generating | downloading | done | failed`
- `progress`: 0–100

### `WorkerStatus`
`id, status, authValid, message, lastSeenAt, updatedAt`.
- Registro único (id="default")
- Worker actualiza cada 60s
- Frontend muestra estado en AuthBanner

---

## 7. Endpoints API (`src/app/api/**`)

| Método + ruta | Función |
|---------------|---------|
| `POST /api/podcasts/generate` | Crear nuevo podcast desde topic/pregunta |
| `POST /api/podcasts/import` | Importar notebook existente de NotebookLM |
| `GET /api/notebooks` | Listar notebooks (solo localhost - requiere CLI) |
| `GET /api/podcasts?status=&q=` | Lista podcasts con filtros |
| `GET /api/podcasts/:id` | Detalle del podcast |
| `POST /api/podcasts/:id` | Incrementa `plays` |
| `DELETE /api/podcasts/:id` | Borra podcast y audio de R2 |
| `POST /api/podcasts/:id/retry` | Reencolar job fallido |
| `GET /api/status/:jobId` | **SSE** - progreso en tiempo real |
| `GET /api/auth/status` | Estado de autenticación NotebookLM + worker |
| `POST /api/auth/login` | **Solo localhost** - Login NotebookLM con browser |

Todos los endpoints marcados con `export const dynamic = "force-dynamic"` para evitar caching.

---

## 8. Worker (`src/workers/worker.ts`)

Bucle infinito: cada `WORKER_POLL_MS` busca el `GenerationJob` más antiguo en `QUEUED` y lo procesa.

**Proceso `processJob`:**

1. Marca Job=RUNNING, Podcast=GENERATING
2. Traduce título → `titleEn`/`titleEs` (opcional)
3. `authCheck()` — verifica sesión NotebookLM válida
4. **Smart Resume:** Si `podcast.notebookId` existe:
   - Verifica si audio está listo con `checkAudioStatus()`
   - Si ready → salta a descarga (rápido ~30s)
   - Si no → regenera audio
5. Si NO existe notebookId:
   - `createNotebook()` → guarda `notebookId`
   - Agrega fuentes (URLs o research)
   - `cleanSources()` - elimina fuentes con errores
   - `waitSourcesReady()`
6. `generateAudio()` con --wait (bloquea ~10-20 min)
7. `downloadAudio()`:
   - Si `podcast.audioId` → descarga ese audio específico
   - Si no → descarga el más reciente
8. Upload a R2 con `uploadAudioFile()`
9. Podcast=PUBLISHED + `audioPath`; Job=DONE, 100%

Errores → Job=FAILED + Podcast=FAILED con `errorMsg`.

**Worker Status Reporting:**
- Cada 60s verifica auth status
- Actualiza `WorkerStatus` en BD
- Frontend muestra en AuthBanner

---

## 9. Wrapper del CLI (`src/lib/notebooklm/client.ts`)

Ejecuta `notebooklm.exe` vía `execFile`, siempre con `--quiet` y `--json` cuando aplica.

**Funciones principales:**
- `authCheck()` / `authStatus()` - Verificar sesión
- `listNotebooks()` - Listar notebooks (MCP)
- `listAudios(notebookId)` - Listar artifacts de audio
- `createNotebook(title)` - Crear notebook
- `addUrlSource(notebookId, url)` - Agregar fuente URL
- `addResearch(notebookId, topic)` - Investigación web
- `cleanSources(notebookId)` - Eliminar fuentes con errores
- `waitSourcesReady(notebookId)` - Esperar fuentes listas
- `checkAudioStatus(notebookId)` - Verificar si audio está listo
- `generateAudio(notebookId, options)` - Generar audio con --wait
- `downloadAudio(notebookId, outPath, artifactId?)` - Descargar audio

**Contexto:** Todos los comandos usan `-n <notebookId>` (no se usa `notebooklm use`).

---

## 10. Storage (`src/lib/storage.ts`)

Abstracción dual: `local` (dev) o `s3` (R2 en prod).

**Modo S3 (Cloudflare R2):**
```typescript
uploadAudioFile(localPath, fileName):
  1. Lee archivo local
  2. Upload a R2 con S3Client
  3. Retorna URL pública
  4. Elimina archivo local
```

**Modo local:**
```typescript
uploadAudioFile(localPath, fileName):
  1. Retorna path relativo: /audio/<fileName>
  2. Archivo permanece en public/audio/
```

Variable `STORAGE_DRIVER` controla el modo.

---

## 11. Frontend Components

**Componentes principales:**
- `PodcastGenerator.tsx` - Modo create vs import toggle
- `NotebookImporter.tsx` - Lista visual (localhost) o manual ID (prod)
- `NotebookCard.tsx` - Tarjeta de notebook con badge de audio
- `ProgressTracker.tsx` - Tracker de progreso con SSE
- `PodcastCard.tsx` - Tarjeta de podcast en Library
- `PodcastPlayer.tsx` - Reproductor de audio embebido
- `AuthBanner.tsx` - Estado de worker + NotebookLM auth

**Internacionalización:**
- Toggle EN/ES en header
- Archivo `src/lib/i18n.tsx` con diccionarios
- Hook `useI18n()` devuelve función `t(key)`

---

## 12. Import Feature

Permite importar notebooks existentes de NotebookLM con dos modos:

**Modo "Use Existing" (solo localhost):**
- Lista audios generados previamente
- Selector de audio específico con fecha
- Download directo (~30s)

**Modo "Generate New":**
- Opciones de formato/duración/idioma
- Genera nuevo audio del mismo notebook
- Permite múltiples versiones

**Producción (manual ID):**
- Input para pegar Notebook ID
- Instrucciones de cómo conseguirlo
- Siempre modo "Generate New"
- No puede verificar audios existentes (requiere CLI)

---

## 13. Autenticación NotebookLM

**Login (solo localhost):**
- Endpoint: `POST /api/auth/login`
- Script: `scripts/nlm_login.py` (Playwright)
- Abre Chrome → login manual → guarda cookies
- Worker poll hasta que auth sea válida

**Verificación:**
- `notebooklm auth check --test`
- Llama API real de NotebookLM para verificar token
- Worker verifica cada 60s y actualiza WorkerStatus

---

## 14. Deployment

**Vercel (Frontend + API):**
```bash
git push origin main  # Auto-deploy
```

Environment variables en Vercel dashboard (Production):
- `DATABASE_URL`
- `R2_*` variables
- `STORAGE_DRIVER=s3`

**Worker (Windows local con PM2):**
```bash
pm2 restart podcast-worker  # Después de cambios
pm2 save                    # Guardar config
```

**Database (Supabase):**
```bash
npm run db:push  # Aplicar cambios de schema
```

---

## 15. Troubleshooting

**Error: SSL certificate verification failed**
- Causa: Windows no confía en certificates
- Fix: `NODE_OPTIONS='--use-system-ca'` en run-worker.js
- Aplicar: `pm2 restart podcast-worker`

**Error: NotebookLM session expired**
- Causa: Token expirado
- Fix: Click "LOGIN TO NOTEBOOKLM" en localhost
- Verificar: `pm2 logs podcast-worker` debe mostrar "Auth status: VÁLIDO"

**Error: Worker offline**
- Verificar: `pm2 status`
- Reiniciar: `pm2 restart podcast-worker`
- Logs: `pm2 logs podcast-worker --lines 100`

**Error: Import no muestra formulario**
- Hard refresh: `Ctrl+Shift+R`
- Verificar deployment en Vercel completó
- Orden correcto de if statements en NotebookImporter.tsx

**Build timeout en /api/notebooks**
- Debe tener `export const dynamic = "force-dynamic"`
- No debe pre-renderizarse en build time

---

**FIN DEL HANDOFF**
