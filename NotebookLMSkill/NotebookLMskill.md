---
name: NotebookLMSkill
description: Acceso completo a Google NotebookLM — crear cuadernos, añadir fuentes, generar podcasts, vídeos, infografías, presentaciones, quizzes, mapas mentales, informes y más. Funciona en Claude Code en Mac y Windows. Activar con /NotebookLMSkill, "instala notebooklm", "crea un podcast sobre X", "genera una infografía", "busca en profundidad sobre X", "añade estas fuentes a NotebookLM", "lista mis cuadernos".
---
<!-- notebooklm-py v0.3.4 | Claridad Artificial | Mac + Windows -->

# NotebookLM — Acceso completo desde Claude

Acceso programático completo a Google NotebookLM, incluyendo funciones no disponibles en la interfaz web. Crea cuadernos, añade fuentes (URLs, YouTube, PDFs, audio, vídeo, imágenes), chatea con el contenido, genera todos los tipos de artefactos y descarga los resultados.

---

## ENTORNO — Ejecutar al inicio de cada activación

Antes de cualquier comando, detectar el sistema operativo y configurar la ruta correcta:

```bash
if [ -f "$HOME/.notebooklm-venv/bin/notebooklm" ]; then
    # Mac / Linux
    NLM="$HOME/.notebooklm-venv/bin/notebooklm"
    VENV_PYTHON="$HOME/.notebooklm-venv/bin/python3"
    echo "Sistema: Mac/Linux"
elif [ -f "$HOME/.notebooklm-venv/Scripts/notebooklm.exe" ]; then
    # Windows
    NLM="$HOME/.notebooklm-venv/Scripts/notebooklm.exe"
    VENV_PYTHON="$HOME/.notebooklm-venv/Scripts/python.exe"
    echo "Sistema: Windows"
else
    echo "NotebookLM no está instalado. Ejecuta el proceso de instalación primero."
    exit 1
fi

# Verificar autenticación
$NLM auth check
```

**Si auth falla:** Ejecutar el Step 0 completo (instalación y login).

A partir de aquí, **todos los comandos usan `$NLM`** en lugar de `notebooklm` directamente. Esto garantiza que funcione en Mac y Windows.

---

## Step 0: Instalación (solo primera vez)

Ejecutar solo cuando `notebooklm` no está instalado ni autenticado.

### Comprobar versión de Python

`notebooklm-py` requiere **Python 3.10+**:

```bash
python3 --version
```

Si Python es inferior a 3.10, instalar una versión compatible:

**macOS (Homebrew):**
```bash
brew install python@3.12
```
Usar `/opt/homebrew/bin/python3.12` (Apple Silicon) o `/usr/local/bin/python3.12` (Intel) para el venv.

**Linux (apt):**
```bash
sudo apt update && sudo apt install -y python3.12 python3.12-venv
```

### Instalar la CLI

```bash
# Seleccionar Python correcto
PYTHON=$(command -v python3.12 2>/dev/null || command -v python3.11 2>/dev/null || command -v python3.10 2>/dev/null || command -v python3)

# Verificar que es 3.10+
$PYTHON -c "import sys; assert sys.version_info >= (3,10), f'Python {sys.version} es demasiado antiguo — necesita 3.10+'; print(f'Usando Python {sys.version}')"

# Crear venv e instalar
$PYTHON -m venv ~/.notebooklm-venv
~/.notebooklm-venv/bin/pip install --quiet --upgrade pip
~/.notebooklm-venv/bin/pip install "notebooklm-py[browser]"
~/.notebooklm-venv/bin/playwright install chromium
```

Verificar que funciona:
```bash
~/.notebooklm-venv/bin/notebooklm --help
```

### Autenticar

**IMPORTANTE:** El comando `notebooklm login` requiere input interactivo en el terminal. La herramienta bash de Claude Code NO admite input interactivo, por lo que `notebooklm login` fallará. Usar siempre este script personalizado de login.

Decirle al usuario:

> Voy a abrir una ventana del navegador. Inicia sesión en tu cuenta de Google y ve a notebooklm.google.com. Tómate el tiempo que necesites, esperaré a que me confirmes antes de cerrar.

Escribir y ejecutar el script de login:

```bash
# Obtener carpeta temporal compatible con Mac y Windows
TMPDIR_PATH=$(python3 -c "import tempfile; print(tempfile.gettempdir())")
LOGIN_SCRIPT="$TMPDIR_PATH/nlm_login.py"
LOGIN_OUTPUT="$TMPDIR_PATH/nlm_login_output.txt"
SIGNAL_FILE="$TMPDIR_PATH/nlm_save_signal"

cat > "$LOGIN_SCRIPT" << 'PYEOF'
import json, time, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

STORAGE_PATH = Path.home() / ".notebooklm" / "storage_state.json"
PROFILE_PATH = Path.home() / ".notebooklm" / "browser_profile"
SIGNAL_FILE = Path(tempfile.gettempdir()) / "nlm_save_signal"

SIGNAL_FILE.unlink(missing_ok=True)
STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)

print("Abriendo navegador para login de Google...")
print("Inicia sesión y ve a notebooklm.google.com")

with sync_playwright() as p:
    browser = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_PATH),
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
    )
    page = browser.pages[0] if browser.pages else browser.new_page()
    page.goto("https://notebooklm.google.com/")

    print("Navegador abierto. Esperando señal de guardado...")
    while not SIGNAL_FILE.exists():
        time.sleep(1)

    print("Señal recibida. Capturando sesión...")
    storage = browser.storage_state()
    with open(STORAGE_PATH, "w") as f:
        json.dump(storage, f)

    cookie_names = [c["name"] for c in storage.get("cookies", [])]
    print(f"Guardadas {len(cookie_names)} cookies: {cookie_names}")
    browser.close()

SIGNAL_FILE.unlink(missing_ok=True)
print(f"Autenticación guardada en: {STORAGE_PATH}")
PYEOF

# Ejecutar con el Python del venv (tiene Playwright instalado)
$VENV_PYTHON "$LOGIN_SCRIPT" > "$LOGIN_OUTPUT" 2>&1 &
echo "Login iniciado (PID=$!). El navegador debería abrirse en unos segundos..."
```

Esperar ~10 segundos y preguntar al usuario si ve el navegador y está dentro.

Cuando el usuario confirme que está en la página de NotebookLM, guardar la sesión:

```bash
python3 -c "import tempfile; from pathlib import Path; (Path(tempfile.gettempdir()) / 'nlm_save_signal').touch()"
sleep 8
cat "$LOGIN_OUTPUT"
```

Verificar autenticación:

```bash
$NLM auth check
$NLM list
```

Si la autenticación es correcta (cookie SID presente), confirmar al usuario y limpiar archivos temporales:

```bash
python3 -c "
import tempfile, os
tmp = tempfile.gettempdir()
for f in ['nlm_login.py', 'nlm_login_output.txt', 'nlm_save_signal']:
    path = os.path.join(tmp, f)
    if os.path.exists(path):
        os.unlink(path)
print('Limpieza completada.')
"
```

Si la autenticación falla (cookie SID ausente), el usuario no completó el login. Borrar el perfil e intentarlo de nuevo:

```bash
rm -rf ~/.notebooklm/browser_profile ~/.notebooklm/storage_state.json
```

Volver al inicio del script de login.

---

## Cuándo se activa esta skill

**Explícito:** "/notebooklm", "usa notebooklm", "instala notebooklm", o cualquier mención de la herramienta por nombre

**Por intención — reconocer peticiones como:**
- "Crea un podcast sobre [tema]"
- "Resume estas URLs/documentos"
- "Genera un quiz sobre mi investigación"
- "Convierte esto en un audio"
- "Crea flashcards para estudiar"
- "Genera un vídeo explicativo"
- "Haz una infografía"
- "Crea un mapa mental de los conceptos"
- "Descarga el quiz en markdown"
- "Añade estas fuentes a NotebookLM"
- "Haz una búsqueda profunda sobre [tema]"
- "Lista mis cuadernos" / "Muéstrame mis notebooks"

---

## Reglas de autonomía

**Recordar:** Usar siempre `$NLM` (detectado en la sección ENTORNO) en lugar de `notebooklm` directamente.

**Ejecutar automáticamente (sin confirmación):**
- `$NLM status` — ver contexto activo
- `$NLM auth check` — verificar autenticación
- `$NLM list` — listar cuadernos
- `$NLM source list` — listar fuentes
- `$NLM artifact list` — listar artefactos
- `$NLM language list` — listar idiomas disponibles
- `$NLM language get` — ver idioma actual
- `$NLM language set` — cambiar idioma
- `$NLM artifact wait` — esperar a que un artefacto esté listo
- `$NLM source wait` — esperar a que una fuente se procese
- `$NLM research status` — ver estado de investigación
- `$NLM research wait` — esperar resultado de investigación
- `$NLM use <id>` — establecer cuaderno activo
- `$NLM create` — crear cuaderno
- `$NLM ask "..."` — consultas de chat (sin `--save-as-note`)
- `$NLM history` — ver historial (solo lectura)
- `$NLM source add` — añadir fuentes

**Preguntar antes de ejecutar:**
- `$NLM delete` — destructivo
- `$NLM generate *` — proceso largo, puede fallar
- `$NLM download *` — escribe en el sistema de archivos
- `$NLM ask "..." --save-as-note` — escribe una nota
- `$NLM history --save` — escribe una nota

---

## Referencia rápida

| Tarea | Comando |
|-------|---------|
| Listar cuadernos | `$NLM list` |
| Crear cuaderno | `$NLM create "Título"` |
| Establecer cuaderno activo | `$NLM use <notebook_id>` |
| Ver cuaderno activo | `$NLM status` |
| Añadir URL | `$NLM source add "https://..."` |
| Añadir archivo | `$NLM source add ./archivo.pdf` |
| Añadir YouTube | `$NLM source add "https://youtube.com/..."` |
| Listar fuentes | `$NLM source list` |
| Esperar procesamiento de fuente | `$NLM source wait <source_id>` |
| Investigación web (rápida) | `$NLM source add-research "consulta"` |
| Investigación web (profunda) | `$NLM source add-research "consulta" --mode deep --no-wait` |
| Ver estado de investigación | `$NLM research status` |
| Esperar investigación | `$NLM research wait --import-all` |
| Chat | `$NLM ask "pregunta"` |
| Chat (fuentes específicas) | `$NLM ask "pregunta" -s src_id1 -s src_id2` |
| Chat (con referencias) | `$NLM ask "pregunta" --json` |
| Chat (guardar como nota) | `$NLM ask "pregunta" --save-as-note` |
| Ver historial de conversación | `$NLM history` |
| Guardar historial como nota | `$NLM history --save` |
| Ver texto completo de fuente | `$NLM source fulltext <source_id>` |
| Generar podcast | `$NLM generate audio "instrucciones"` |
| Generar vídeo | `$NLM generate video "instrucciones"` |
| Generar informe | `$NLM generate report --format briefing-doc` |
| Generar quiz | `$NLM generate quiz` |
| Generar flashcards | `$NLM generate flashcards` |
| Generar infografía | `$NLM generate infographic` |
| Generar mapa mental | `$NLM generate mind-map` |
| Generar presentación | `$NLM generate slide-deck` |
| Revisar una diapositiva | `$NLM generate revise-slide "prompt" --artifact <id> --slide 0` |
| Ver estado de artefactos | `$NLM artifact list` |
| Esperar artefacto | `$NLM artifact wait <artifact_id>` |
| Descargar audio | `$NLM download audio ./output.mp3` |
| Descargar vídeo | `$NLM download video ./output.mp4` |
| Descargar presentación (PDF) | `$NLM download slide-deck ./slides.pdf` |
| Descargar presentación (PPTX) | `$NLM download slide-deck ./slides.pptx --format pptx` |
| Descargar informe | `$NLM download report ./informe.md` |
| Descargar mapa mental | `$NLM download mind-map ./mapa.json` |
| Descargar tabla de datos | `$NLM download data-table ./datos.csv` |
| Descargar quiz | `$NLM download quiz quiz.json` |
| Descargar flashcards | `$NLM download flashcards cards.json` |
| Listar idiomas | `$NLM language list` |
| Cambiar idioma | `$NLM language set es` |

---

## Tipos de generación

Todos los comandos `generate` admiten:
- `-s, --source` para usar fuentes específicas en lugar de todas
- `--language` para fijar el idioma de salida (por defecto 'en', usar 'es' para español)
- `--json` para salida legible por máquina
- `--retry N` para reintentar automáticamente si hay límite de tasa

| Tipo | Comando | Opciones | Descarga |
|------|---------|---------|----------|
| Podcast | `generate audio` | `--format [deep-dive\|brief\|critique\|debate]`, `--length [short\|default\|long]` | .mp3 |
| Vídeo | `generate video` | `--format [explainer\|brief]`, `--style [auto\|classic\|whiteboard\|kawaii\|anime\|watercolor\|retro-print\|heritage\|paper-craft]` | .mp4 |
| Presentación | `generate slide-deck` | `--format [detailed\|presenter]`, `--length [default\|short]` | .pdf / .pptx |
| Revisar diapositiva | `generate revise-slide "prompt" --artifact <id> --slide N` | `--wait`, `--notebook` | *(descarga el deck actualizado)* |
| Infografía | `generate infographic` | `--orientation [landscape\|portrait\|square]`, `--detail [concise\|standard\|detailed]` | .png |
| Informe | `generate report` | `--format [briefing-doc\|study-guide\|blog-post\|custom]`, `--append "instrucciones extra"` | .md |
| Mapa mental | `generate mind-map` | *(síncrono, instantáneo)* | .json |
| Tabla de datos | `generate data-table` | descripción requerida | .csv |
| Quiz | `generate quiz` | `--difficulty [easy\|medium\|hard]`, `--quantity [fewer\|standard\|more]` | .json/.md/.html |
| Flashcards | `generate flashcards` | `--difficulty [easy\|medium\|hard]`, `--quantity [fewer\|standard\|more]` | .json/.md/.html |

---

## Flujos comunes

### Investigación a Podcast
1. `$NLM create "Investigación: [tema]"`
2. `$NLM source add` por cada URL o documento
3. Esperar: `$NLM source list --json` hasta que todos tengan status=READY
4. `$NLM generate audio "Enfócate en [ángulo específico]"`
5. `$NLM artifact list` para ver el estado
6. `$NLM download audio ./podcast.mp3` cuando esté listo

### Investigación profunda
1. `$NLM create "Research: [tema]"`
2. `$NLM source add-research "[consulta]" --mode deep --no-wait`
3. `$NLM research wait --import-all`
4. `$NLM ask "Resume los hallazgos principales"`

### Análisis de documentos
1. `$NLM create "Análisis: [proyecto]"`
2. `$NLM source add ./doc.pdf` (o URLs)
3. `$NLM ask "Resume los puntos clave"`
4. Continuar el chat según necesidad

### Presentación desde fuentes
1. `$NLM create "Presentación: [tema]"`
2. Añadir fuentes con `$NLM source add`
3. `$NLM generate slide-deck --format detailed`
4. `$NLM download slide-deck ./presentacion.pptx --format pptx`

---

## Formatos de salida (--json)

```json
// $NLM list --json
{"notebooks": [{"id": "...", "title": "...", "created_at": "..."}]}

// $NLM source list --json
{"sources": [{"id": "...", "title": "...", "status": "ready|processing|error"}]}

// $NLM artifact list --json
{"artifacts": [{"id": "...", "title": "...", "type": "Audio Overview", "status": "in_progress|pending|completed|unknown"}]}
```

---

## Manejo de errores

| Error | Causa | Acción |
|-------|-------|--------|
| Error de auth/cookie | Sesión caducada | Volver al script de login personalizado (Step 0 → Autenticar) |
| "No notebook context" | Cuaderno no establecido | Ejecutar `$NLM use <id>` |
| Rate limiting | Límite de Google | Esperar 5-10 min y reintentar |
| Descarga falla | Generación incompleta | Comprobar `$NLM artifact list` para ver el estado |
| `notebooklm` no encontrado | CLI no instalada | Ejecutar el instalador y el Step 0 |

---

## Limitaciones conocidas

- La generación de audio, vídeo, quiz, flashcards, infografías y presentaciones puede fallar por límites de tasa de Google
- Tiempos de generación orientativos: audio 10-20 min, vídeo 15-45 min, quiz/flashcards 5-15 min
- Esta es una API no oficial — Google puede hacer cambios sin previo aviso
