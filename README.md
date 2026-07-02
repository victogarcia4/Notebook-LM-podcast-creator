# 🎙️ Podcast Creator

> Genera podcasts automáticamente con **NotebookLM** a partir de un tema o una pregunta, y publícalos en una biblioteca web para escucharlos y descargarlos.

Escribe un tema → NotebookLM investiga en la web, redacta el guion y produce un podcast conversacional → la app lo publica y lo reproduce en el navegador. Todo el flujo está automatizado.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss)

---

## ✨ Características

- **Generación 1-click**: escribe un tema (o una pregunta) y obtén un podcast.
- **Opciones de formato**: deep-dive, brief, critique o debate; duración corta/normal/larga; múltiples idiomas.
- **Fuentes flexibles**: deja que la app investigue el tema en la web automáticamente, o aporta hasta 10 URLs propias.
- **Progreso en tiempo real**: seguimiento por etapas vía Server-Sent Events (puedes cerrar la pestaña y volver más tarde).
- **Biblioteca web**: grid de podcasts con reproductor HTML5, descarga de MP3 y contador de reproducciones.

---

## 🏗️ Arquitectura

```
Navegador ──HTTP / SSE──▶ Next.js (UI + API) ──▶ SQLite (Prisma)
                                                     ▲
                            Worker (proceso aparte) ─┘
                                     │
                                     ▼
                           notebooklm.exe (CLI)
                    crear → investigar → generar → descargar
```

- El **frontend + API** (`npm run dev`) valida la petición, crea el podcast y lo encola en la base de datos.
- El **worker** (`npm run worker`) es un proceso separado que sondea la cola y ejecuta el flujo de NotebookLM: crea el notebook, importa fuentes, genera el audio, descarga el MP3 y publica el podcast.
- El progreso se transmite al navegador en tiempo real mediante **Server-Sent Events**.

> ⚠️ El worker **debe** ejecutarse en **Windows**, porque depende del CLI `notebooklm.exe`.

---

## 🧰 Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Server-Sent Events |
| Base de datos | Prisma ORM + SQLite |
| Cola de trabajos | Tabla `GenerationJob` + worker de sondeo (proceso `tsx`) |
| Integración IA | [`notebooklm-py`](https://pypi.org/project/notebooklm-py/) CLI vía `child_process` |

---

## 📋 Requisitos previos

1. **Node.js 20+**
2. **CLI de NotebookLM** instalado y autenticado. Verifícalo con:
   ```bash
   notebooklm auth check
   ```
   Por defecto la app busca el ejecutable en
   `C:/Users/<usuario>/.notebooklm-venv/Scripts/notebooklm.exe`.

---

## 🚀 Puesta en marcha

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/victogarcia4/Notebook-LM-podcast-creator.git
cd Notebook-LM-podcast-creator
npm install

# 2. Configurar variables de entorno
cp .env.example .env
#   → edita NLM_PATH con la ruta a tu notebooklm.exe (usa barras normales /)

# 3. Crear la base de datos
npm run db:push
```

Necesitas **dos procesos en paralelo**:

```bash
# Terminal 1 — worker (procesa la cola y genera los podcasts)
npm run worker

# Terminal 2 — servidor web
npm run dev
```

Abre **http://localhost:3000**, escribe un tema y pulsa **Generar podcast**.
La generación tarda entre **10 y 20 minutos**; al terminar, el podcast aparece en la **Biblioteca**.

> Si solo arrancas `npm run dev`, la web funciona y puedes crear podcasts, pero se quedarán **"En cola"** hasta que también levantes el `worker`.

---

## 📜 Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor web Next.js (puerto 3000) |
| `npm run worker` | Worker que procesa la cola (con autoreload) |
| `npm run worker:once` | Worker sin autoreload |
| `npm run build` | Build de producción |
| `npm run db:push` | Aplica el esquema Prisma a SQLite |
| `npm run db:studio` | Explorador visual de la base de datos |

---

## ⚙️ Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión SQLite | `file:./dev.db` |
| `NLM_PATH` | Ruta al ejecutable `notebooklm.exe` (usa `/`) | `C:/Users/tu-usuario/.notebooklm-venv/Scripts/notebooklm.exe` |
| `AUDIO_DIR` | Carpeta de MP3s | `public/audio` |
| `WORKER_POLL_MS` | Intervalo de sondeo del worker (ms) | `5000` |

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx                     # Home (generador)
│   ├── library/page.tsx             # Biblioteca
│   ├── podcast/[id]/page.tsx        # Detalle + reproductor
│   └── api/
│       ├── podcasts/generate/       # POST: crear y encolar
│       ├── podcasts/                # GET: lista / detalle
│       └── status/[jobId]/          # SSE: progreso en tiempo real
├── components/                      # PodcastGenerator, ProgressTracker, AudioPlayer, …
├── lib/
│   ├── db.ts                        # Cliente Prisma
│   └── notebooklm/client.ts         # Wrapper del CLI de NotebookLM
├── hooks/useSSE.ts                  # Hook de Server-Sent Events
└── workers/worker.ts                # Worker de generación
prisma/schema.prisma                 # Modelos: Podcast, PodcastSource, GenerationJob
```

---

## 🔍 Cómo funciona (flujo del worker)

1. `notebooklm create "Podcast: <tema>"` → crea el notebook.
2. `notebooklm source add-research "<tema>" --import-all` → investiga e importa fuentes (o `source add <url>` por cada URL aportada).
3. Espera a que las fuentes estén listas.
4. `notebooklm generate audio --wait --format … --length … --language …` → genera el podcast.
5. `notebooklm download audio <ruta>.mp3` → descarga el MP3 a `public/audio/`.
6. Marca el podcast como **PUBLISHED**.

---

## 🗺️ Roadmap

- [ ] Autenticación de usuarios y podcasts privados/públicos.
- [ ] Migración a PostgreSQL + Redis + BullMQ para escalar.
- [ ] Almacenamiento en S3 / Cloudflare R2 + CDN.
- [ ] Portadas y transcripciones automáticas.
- [ ] Despliegue (frontend en la nube + worker en Windows).

---

## ⚠️ Notas y limitaciones

- Usa la librería **no oficial** `notebooklm-py`; Google puede introducir cambios sin previo aviso.
- Si la sesión de NotebookLM expira, el worker marcará el job como `FAILED`; vuelve a autenticarte con el flujo de login del CLI.
- Los tiempos de generación son orientativos (audio: 10–20 min) y pueden verse afectados por los límites de tasa de Google.

---

## 📄 Licencia

MIT
