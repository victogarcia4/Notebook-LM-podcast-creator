# Podcast Creator

Genera podcasts automaticamente con Google NotebookLM a partir de un tema o pregunta, y los publica en una biblioteca web para escucharlos o descargarlos.

## Estado de arquitectura

La app esta preparada para modo publico hibrido:

- Next.js se despliega publicamente, por ejemplo en Vercel.
- La base de datos compartida es Postgres, por ejemplo Neon o Supabase.
- Los MP3 se guardan en storage compatible con S3, por ejemplo Cloudflare R2 o AWS S3.
- El worker sigue corriendo en una maquina Windows local porque depende de `notebooklm.exe`.
- El worker Windows procesa la cola, sube el MP3 al bucket y actualiza la BD publica.

```
Browser -> Next.js public API/UI -> Postgres
                                  ^
Windows worker -> notebooklm.exe -+-> S3/R2 audio storage
```

## Requisitos

- Node.js 20+
- Postgres publico con SSL
- Bucket S3/R2 con URL publica para audio
- `notebooklm.exe` instalado y autenticado en Windows

## Variables principales

Ver `.env.example` para la lista completa.

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="podcast-audio"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://media.tu-dominio.com"
S3_KEY_PREFIX="audio"
NLM_PATH="C:/Users/<usuario>/.notebooklm-venv/Scripts/notebooklm.exe"
```

En Vercel configura `DATABASE_URL` y las variables `STORAGE_DRIVER/S3_*`. En el worker Windows usa las mismas variables, ademas de `NLM_PATH`.

## Setup local/public

```bash
npm install
npm run db:push
npm run build
```

### Worker como servicio permanente (recomendado para producción)

Para que el worker corra 24/7 en segundo plano y se auto-inicie con Windows:

```powershell
.\setup-worker-service.ps1
```

Esto instala PM2 y configura el worker como servicio. Comandos útiles:

```bash
pm2 status                    # Ver estado del worker
pm2 logs podcast-worker       # Ver logs en tiempo real
pm2 restart podcast-worker    # Reiniciar worker
pm2 stop podcast-worker       # Detener worker
```

### Worker manual (desarrollo)

Para procesar jobs manualmente con autoreload:

```bash
npm run worker
```

Para desarrollo local de la UI:

```bash
npm run dev
```

## Flujo del worker

1. Toma el `GenerationJob` mas antiguo en `QUEUED`.
2. Verifica la sesion real de NotebookLM.
3. Crea notebook, importa fuentes o investiga el tema.
4. Genera el audio y descarga el MP3 a `AUDIO_DIR`.
5. Si `STORAGE_DRIVER=s3`, sube el MP3 a S3/R2.
6. Guarda la URL publica en `Podcast.audioPath`.
7. Marca el job como `DONE`.

El worker tambien actualiza `WorkerStatus` en Postgres. La UI publica usa `/api/auth/status` para saber si el worker Windows esta online y autenticado.

## Scripts

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | Servidor web local |
| `npm run build` | Build de produccion |
| `npm run start` | Servidor Next de produccion |
| `npm run worker` | Worker Windows con autoreload |
| `npm run worker:once` | Worker Windows sin autoreload |
| `npm run db:push` | Aplica el schema Prisma al Postgres configurado |
| `npm run db:studio` | Abre Prisma Studio |

## Despliegue publico

1. Crear DB Postgres en Neon/Supabase.
2. Crear bucket R2/S3 y configurar una URL publica (`S3_PUBLIC_BASE_URL`).
3. Poner variables en Vercel.
4. Ejecutar `npm run db:push` una vez apuntando al Postgres.
5. Desplegar Next.js.
6. En Windows, configurar el mismo `.env`, autenticar NotebookLM y ejecutar `npm run worker`.

## Limitaciones actuales

- No hay usuarios ni podcasts privados.
- La cola sigue siendo una tabla Postgres sondeada por un worker.
- El worker no escala horizontalmente; esta pensado para una maquina Windows.
- Si la sesion de NotebookLM caduca, hay que reautenticar en Windows.
- Faltan portadas, transcripciones, paginacion avanzada y otros formatos de salida.
