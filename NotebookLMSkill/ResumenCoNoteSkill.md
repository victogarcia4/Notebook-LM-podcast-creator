---
name: resumenconote
description: Resumen de sesión con exportación a un nuevo cuaderno de NotebookLM. Al final de cada sesión crea un cuaderno nuevo en NotebookLM con el nombre que elija el usuario y sube el resumen de la conversación como fuente. Funciona en Claude Code y Claude Cowork. Activar con /resumenconote o cuando el usuario diga "resumenconote", "resumen de sesión", "guarda esta sesión", "wrap up", "cierra sesión".
---

# ResumenCoNote — Resumen de sesión a NotebookLM

Al final de cada sesión, esta skill resume lo que se ha trabajado y lo sube como fuente a un cuaderno nuevo en NotebookLM con el nombre que elija el usuario.

---

## Paso 0 — Detectar entorno y verificar autenticación

Antes de hacer nada, detecta en qué entorno estás y configura el comando correcto:

```bash
if [ -f "$HOME/.notebooklm-venv/bin/notebooklm" ]; then
    NLM="$HOME/.notebooklm-venv/bin/notebooklm"
    echo "Entorno detectado: Claude Code"
else
    pip install notebooklm-py --quiet 2>/dev/null
    NLM="notebooklm"
    echo "Entorno detectado: Cowork"
fi

$NLM auth check
```

**Si auth falla en Claude Code:** Dile al usuario:
> "Necesitas autenticarte primero. Escribe `instala notebooklm` para iniciar el proceso de login."

**Si auth falla en Cowork:** Dile al usuario:
> "Las cookies de NotebookLM han caducado o la skill de NotebookLM no está cargada. Vuelve a Claude Code, escribe `añade notebooklm a cowork`, y sube el nuevo archivo a Cowork junto con esta skill."

---

## Paso 1 — Preguntar el nombre del cuaderno

Pregunta al usuario:

> "¿Cómo quieres llamar al cuaderno de esta sesión en NotebookLM?"

Espera la respuesta antes de continuar. El nombre que dé el usuario es el que usarás en el Paso 3.

---

## Paso 2 — Analizar la conversación y escribir el resumen

Revisa toda la conversación desde el principio e identifica:

- **Qué se trabajó** — tareas completadas, archivos creados, problemas resueltos
- **Decisiones tomadas** — qué se decidió y por qué
- **Aprendizajes clave** — cosas no obvias que surgieron
- **Hilos abiertos** — temas sin terminar o a retomar la próxima vez

Genera el resumen en este formato y guárdalo en un archivo temporal:

```bash
TODAY=$(date +%Y-%m-%d)
SUMMARY_FILE="/tmp/resumen-sesion-$TODAY.md"
```

El contenido del archivo debe seguir esta estructura:

```markdown
# Resumen de sesión — YYYY-MM-DD

## Qué trabajamos
- Puntos clave del trabajo realizado

## Decisiones tomadas
- Decisiones y su razonamiento

## Aprendizajes clave
- Insights no obvios que surgieron

## Hilos abiertos
- Temas a retomar en la próxima sesión

## Herramientas y sistemas usados
- Lista de herramientas, archivos o servicios involucrados
```

Escribe el archivo con el contenido real del resumen usando el bash tool.

Si ya existe un archivo con esa fecha (varias sesiones el mismo día), usa `/tmp/resumen-sesion-$TODAY-2.md`, luego `-3.md`, etc.

---

## Paso 3 — Crear el cuaderno y subir el resumen

```bash
# Crear el cuaderno con el nombre elegido por el usuario
NOTEBOOK_JSON=$($NLM create "NOMBRE_ELEGIDO_POR_USUARIO" --json)

# Extraer el ID del cuaderno del JSON de respuesta
NOTEBOOK_ID=$(echo "$NOTEBOOK_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# La respuesta puede ser el objeto directamente o envuelto en 'notebooks'
if 'id' in data:
    print(data['id'])
elif 'notebooks' in data and data['notebooks']:
    print(data['notebooks'][0]['id'])
else:
    print('')
" 2>/dev/null)

# Si no se pudo extraer el ID, buscarlo por título en la lista
if [ -z "$NOTEBOOK_ID" ]; then
    NOTEBOOK_ID=$($NLM list --json | python3 -c "
import sys, json
data = json.load(sys.stdin)
notebooks = data.get('notebooks', [])
nombre = 'NOMBRE_ELEGIDO_POR_USUARIO'
match = next((n['id'] for n in notebooks if n.get('title','') == nombre), '')
print(match)
" 2>/dev/null)
fi

# Verificar que tenemos un ID válido
if [ -z "$NOTEBOOK_ID" ]; then
    echo "Error: no se pudo obtener el ID del cuaderno. Inténtalo de nuevo."
    exit 1
fi

# Establecer el cuaderno como contexto activo
$NLM use "$NOTEBOOK_ID"

# Subir el resumen como fuente
$NLM source add "$SUMMARY_FILE"

# Limpiar archivo temporal
rm -f "$SUMMARY_FILE"
```

---

## Paso 4 — Confirmar al usuario

Dile al usuario de forma breve:

> "✓ Resumen guardado en NotebookLM en el cuaderno **[nombre]**.
>
> En unos segundos estará listo para consultar. Puedes preguntarle sobre esta sesión, generar un podcast, un informe o flashcards desde él.
>
> [Lista los hilos abiertos si los hay, para que no los olvide.]"

---

## Manejo de errores

| Error | Causa | Acción |
|-------|-------|--------|
| Auth falla | Cookies caducadas o skill de NotebookLM no cargada | Ver Paso 0 |
| ID del cuaderno vacío | Respuesta inesperada de la API | Reintentar o crear el cuaderno manualmente en notebooklm.google.com |
| `source add` falla | Archivo temporal no existe | Volver al Paso 2 y regenerar el archivo |
| `notebooklm` no encontrado | CLI no instalada | En Code: instala con la NotebookLMSkill. En Cowork: asegúrate de tener la skill de NotebookLM cargada |

---

## Requisitos

Esta skill necesita que **NotebookLM esté autenticado**:

- **En Claude Code:** Instala y autentícate con la `NotebookLMSkill` primero. Actívala con "instala notebooklm".
- **En Cowork:** Carga la `NotebookLMSkill-Cowork.md` junto con esta skill. Sin ella no hay autenticación.
