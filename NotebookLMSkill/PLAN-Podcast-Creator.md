# 📋 PLAN COMPLETO: Aplicación Web de Podcasts con NotebookLM

> Plataforma web que genera podcasts automáticamente usando NotebookLM a partir de un tema o pregunta ingresada por el usuario, y los publica para escuchar en línea.

---

## 📱 1. PRD (Product Requirements Document)

### Visión del Producto
Plataforma web que democratiza la creación de podcasts de calidad mediante IA, permitiendo generar contenido de audio profesional a partir de temas de interés con un flujo de 1-click.

### Objetivos
- Permitir a cualquier usuario generar un podcast a partir de un tema/pregunta sin conocimientos técnicos.
- Publicar y reproducir los podcasts en una biblioteca web.
- Automatizar completamente el flujo NotebookLM (crear notebook → investigar → generar audio → descargar → publicar).

### User Stories (MVP)

**Epic 1 — Generación de Podcasts**
- Como usuario, ingreso un tema o pregunta (10–500 caracteres) y genero un podcast.
- Como usuario, selecciono formato (deep-dive, brief, critique, debate), duración (short, default, long) e idioma.
- Como usuario, opcionalmente agrego URLs de fuentes (hasta 10).
- Como usuario, veo el progreso en tiempo real y puedo cerrar la página y volver después.

**Epic 2 — Biblioteca de Podcasts**
- Como visitante, veo un grid de podcasts publicados y los reproduzco en el navegador.
- Como visitante, busco por keywords y filtro por idioma/formato/duración/fecha.
- Como visitante, descargo el MP3 (opcional).

**Epic 3 — Gestión de Cuenta (Post-MVP)**
- Como usuario registrado, veo mis podcasts, los marco como favoritos y gestiono su visibilidad.

### Requisitos No Funcionales
- Tiempo promedio de generación < 15 min.
- Tasa de éxito > 95%.
- UI responsive (móvil + escritorio).
- Manejo robusto de errores y rate limits de Google.

---

## 🏗️ 2. TRD (Technical Requirements Document)

### Stack Tecnológico

**Frontend**
- Next.js 14+ (App Router) + React 18 + TypeScript
- shadcn/ui + Tailwind CSS
- Zustand (estado UI) + React Query (estado servidor)
- Server-Sent Events (SSE) para progreso en tiempo real

**Backend**
- Node.js 20+ con TypeScript
- Next.js API Routes
- Sistema de colas para trabajos asíncronos (10–20 min)
- Prisma ORM
- `child_process` (execFile) para ejecutar `notebooklm.exe`

**Infraestructura**
- Base de datos: PostgreSQL (o SQLite para MVP local)
- Cola: BullMQ + Redis (o cola en-proceso para MVP)
- Almacenamiento MP3: filesystem local (o S3/Cloudflare R2 en producción)

### Arquitectura del Sistema

```
┌──────────────────────────┐
│   Cliente (Browser)      │
│   Next.js + React        │
└───────────┬──────────────┘
            │ HTTP / SSE
┌───────────▼──────────────┐
│   Backend API (Next.js)  │
│   /api/podcasts/generate │
│   /api/status/:jobId     │
└──┬─────────────────┬─────┘
   │                 │
   ▼                 ▼
┌────────┐    ┌──────────────┐
│  DB    │    │  Job Queue   │
└────────┘    └──────┬───────┘
                     │
              ┌──────▼───────────┐
              │  Worker Process  │
              │  1. Create NB    │
              │  2. Research      │
              │  3. Generate audio│
              │  4. Download MP3  │
              └──────┬───────────┘
                     │
              ┌──────▼───────────┐
              │  NotebookLM CLI  │
              │  (notebooklm.exe)│
              └──────────────────┘
```

### Modelo de Datos (Prisma)
- `Podcast` — título, tema, estado, formato, duración, idioma, ruta del audio, notebookId, contador de reproducciones, timestamps.
- `PodcastSource` — fuentes usadas (URL/research), FK a Podcast.
- `GenerationJob` — jobId, estado, etapa actual, progreso %, error, FK a Podcast.
- `User` / `Favorite` — (Post-MVP).

### API Endpoints
- `POST /api/podcasts/generate` — valida input, crea Podcast + Job, encola.
- `GET /api/podcasts` — lista con filtros y paginación.
- `GET /api/podcasts/:id` — detalle.
- `GET /api/status/:jobId` — SSE de progreso.

### Worker — Flujo NotebookLM
Ruta del CLI en Windows: `C:\Users\<user>\.notebooklm-venv\Scripts\notebooklm.exe`

1. `create "Podcast: <tema>"` → capturar notebookId
2. `source add-research "<tema>"` (o `source add <url>` por cada URL)
3. Esperar fuentes READY (`source list --json`)
4. `generate audio "<instrucciones>" --format <fmt> --length <len> --language <lang>`
5. `artifact wait <id>` hasta completed
6. `download audio <ruta.mp3>`
7. Actualizar Podcast → PUBLISHED, guardar ruta del MP3.

### Seguridad y Rate Limiting
- Rate limit por IP (p.ej. 5 generaciones / 15 min).
- Retry exponencial en el worker ante rate limits de Google.
- Validación y saneamiento del input.
- Mensajes de error claros al usuario.

---

## 📁 3. Estructura del Proyecto

```
podcast-creator/
├── src/
│   ├── app/
│   │   ├── page.tsx                     # Homepage (generador)
│   │   ├── library/page.tsx             # Biblioteca
│   │   ├── podcast/[id]/page.tsx        # Detalle + reproductor
│   │   └── api/
│   │       ├── podcasts/
│   │       │   ├── route.ts             # GET lista
│   │       │   ├── [id]/route.ts        # GET detalle
│   │       │   └── generate/route.ts    # POST generar
│   │       └── status/[jobId]/route.ts  # SSE
│   ├── components/
│   │   ├── ui/                          # shadcn/ui
│   │   ├── PodcastGenerator.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── ProgressTracker.tsx
│   │   └── PodcastCard.tsx
│   ├── lib/
│   │   ├── db.ts                        # Prisma client
│   │   ├── queue.ts                     # Setup de la cola
│   │   ├── storage.ts                   # Abstracción de storage
│   │   └── notebooklm/
│   │       └── client.ts               # Wrapper del CLI
│   ├── workers/
│   │   └── podcast-generator.ts         # Worker principal
│   └── hooks/
│       ├── usePodcasts.ts
│       └── useSSE.ts
├── prisma/
│   └── schema.prisma
├── public/audio/                        # MP3s (storage local MVP)
├── .env.example
└── package.json
```

---

## 🗓️ 4. Roadmap de Implementación

| Fase | Descripción | Días |
|------|-------------|------|
| **0** | Setup: Next.js + TypeScript, dependencias, Prisma, DB | 1 |
| **1** | Wrapper TypeScript del CLI NotebookLM + tests | 2–3 |
| **2** | Sistema de colas + worker con flujo completo | 4 |
| **3** | API endpoints (generate, list, detail, SSE) | 5–6 |
| **4** | Frontend: generador + progreso en tiempo real | 7–8 |
| **5** | Frontend: biblioteca (grid, filtros, búsqueda) | 9–10 |
| **6** | Frontend: página de detalle + reproductor | 11 |
| **7** | Storage / CDN para MP3s | 12 |
| **8** | Testing E2E + optimización + logging | 13–14 |
| **9** | Deploy | 15 |

---

## ⚠️ Consideraciones Críticas

### 1. El worker debe correr en Windows
El CLI `notebooklm.exe` **solo funciona en Windows**. Opciones:
- **A (recomendada para MVP):** worker local en la máquina Windows del usuario, apuntando a DB local o en la nube.
- **B:** VPS Windows en la nube (más costoso).
- **C:** Wine en Linux (complejo, no recomendado).

Esto implica que el frontend puede desplegarse en cualquier lado, pero el proceso que genera los podcasts vive en Windows.

### 2. Tiempos de generación
Los podcasts tardan **10–20 min**. El sistema de colas + SSE es esencial para una buena UX (el usuario puede irse y volver).

### 3. Rate Limits de NotebookLM
Google puede limitar solicitudes. Implementar rate limiting propio, retry exponencial y mensajes claros.

### 4. Autenticación de NotebookLM
La sesión se mantiene vía cookies en `~/.notebooklm/storage_state.json`. Si expira, hay que re-autenticar con el flujo de login de Playwright de la skill.

---

## 🎯 Métricas de Éxito
- Técnicas: generación < 15 min, éxito > 95%, uptime > 99%.
- Producto: 100 podcasts el primer mes, 1000 reproducciones, NPS > 50.

---

## 🚀 Próximos Pasos
1. Scaffold del proyecto (Fase 0) en la carpeta `Podcast Creator`.
2. Wrapper del CLI y validación de que genera un podcast end-to-end.
3. Implementación secuencial siguiendo el roadmap.
