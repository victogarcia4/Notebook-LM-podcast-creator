"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Lang = "en" | "es";

type Dict = Record<string, string>;

const EN: Dict = {
  "nav.create": "Create",
  "nav.library": "Library",
  "footer.builtBy": "Built by Dr. Victor Garcia M",
  "footer.tag": "Podcasts generated with NotebookLM",

  "auth.checking": "Checking NotebookLM session…",
  "auth.active": "NotebookLM session active — ready to generate podcasts.",
  "auth.requirement":
    "This app requires a recent, active NotebookLM session to generate podcasts.",
  "auth.expiredTitle": "A recent NotebookLM session is required",
  "auth.expiredBody":
    "Your NotebookLM session has expired or is missing. You must sign in again before you can generate podcasts.",
  "auth.howto":
    "To re-authenticate: open a terminal and run  notebooklm login  (or ask to re-run the login flow), then reload this page.",
  "auth.recheck": "Re-check",
  "auth.login": "Log in to NotebookLM",
  "auth.loggingIn":
    "A browser window opened — sign in to Google and open notebooklm.google.com. This page will detect it automatically…",
  "auth.loginError": "Could not start the browser login (run the app locally on Windows).",
  "auth.statusError": "Could not check the worker status.",
  "auth.workerOffline":
    "The public app is online, but the Windows worker is not connected. New jobs will stay queued until the worker starts.",
  "auth.workerInvalid":
    "The Windows worker is connected, but its NotebookLM session is not valid. New jobs may fail until the worker is re-authenticated.",

  "hero.eyebrow": "AI-POWERED PODCAST STUDIO",
  "hero.titlePre": "Turn any topic into a",
  "hero.titleAccent": "podcast",
  "hero.subtitle":
    "Type a topic or a question. NotebookLM researches it, writes the script and produces a conversational podcast you can listen to and share.",

  "gen.topicLabel": "Podcast topic or question",
  "gen.topicPlaceholder":
    "e.g. The impact of artificial intelligence on higher education…",
  "gen.format": "Format",
  "gen.length": "Length",
  "gen.language": "Language",
  "gen.sourcesToggle": "Custom sources (optional)",
  "gen.sourcesLabel":
    "URLs, one per line (up to 10). Leave empty and the app will research the topic automatically.",
  "gen.sourcesPlaceholder":
    "https://example.com/article-1\nhttps://youtube.com/watch?v=…",
  "gen.submit": "Generate podcast",
  "gen.submitting": "Starting…",
  "gen.hint":
    "Generation takes 10–20 minutes. You can close this page and come back later; the podcast will appear in the Library.",
  "gen.errMinLength": "The topic must be at least 10 characters.",
  "gen.connecting": "Connecting…",
  "gen.createAnother": "Create another",
  "gen.modeCreate": "Create New",
  "gen.modeImport": "Import from NotebookLM",

  "import.hasAudioTitle": "✓ This notebook has existing audio",
  "import.hasAudioDesc": "The existing audio will be downloaded directly (~30 seconds). Format and length settings below will be ignored.",
  "import.noAudioDesc": "This notebook has no audio yet. It will be generated with your settings below (~10-20 minutes).",
  "import.modeLabel": "Import Mode",
  "import.useExisting": "Use Existing Audio",
  "import.generateNew": "Generate New",
  "import.selectAudio": "Select Audio",
  "import.audioWillDownload": "The selected audio will be downloaded directly (~30 seconds).",
  "import.willGenerate": "A new audio will be generated with your settings below (~10-20 minutes).",
  "import.created": "Created",

  "fmt.deep-dive": "Deep Dive",
  "fmt.brief": "Brief",
  "fmt.critique": "Critique",
  "fmt.debate": "Debate",
  "len.short": "Short",
  "len.default": "Normal",
  "len.long": "Long",

  "lang.es": "Spanish",
  "lang.en": "English",
  "lang.pt": "Portuguese",
  "lang.fr": "French",

  "progress.generating": "Generating your podcast…",
  "progress.done": "Podcast ready!",
  "progress.failed": "Generation failed",
  "stage.queued": "Queued",
  "stage.created": "Notebook created",
  "stage.research": "Researching sources",
  "stage.generating": "Generating audio",
  "stage.downloading": "Downloading",
  "stage.done": "Published",
  "progress.listen": "Listen to podcast →",

  "status.PUBLISHED": "Published",
  "status.GENERATING": "Generating…",
  "status.PENDING": "Queued",
  "status.FAILED": "Failed",
  "card.plays": "plays",
  "action.delete": "Delete",
  "action.retry": "Retry",
  "action.confirmDelete": "Delete this podcast? This cannot be undone.",
  "action.retrying": "Retrying…",
  "action.deleting": "Deleting…",

  "library.title": "Library",
  "library.empty": "No podcasts yet. Create the first one!",
  "library.one": "podcast",
  "library.many": "podcasts",

  "detail.back": "Library",
  "detail.plays": "plays",
  "detail.failed": "Generation failed",
  "detail.noStatus": "No status information.",
  "detail.sources": "Sources",
  "detail.download": "Download MP3",
  "detail.loading": "Loading…",
  "detail.notFound": "Podcast not found.",
};

const ES: Dict = {
  "nav.create": "Crear",
  "nav.library": "Biblioteca",
  "footer.builtBy": "Built by Dr. Victor Garcia M",
  "footer.tag": "Podcasts generados con NotebookLM",

  "auth.checking": "Comprobando sesión de NotebookLM…",
  "auth.active": "Sesión de NotebookLM activa — lista para generar podcasts.",
  "auth.requirement":
    "Esta app requiere una sesión de NotebookLM reciente y activa para generar podcasts.",
  "auth.expiredTitle": "Se requiere una sesión reciente de NotebookLM",
  "auth.expiredBody":
    "Tu sesión de NotebookLM expiró o no existe. Debes iniciar sesión de nuevo antes de poder generar podcasts.",
  "auth.howto":
    "Para volver a autenticarte: abre una terminal y ejecuta  notebooklm login  (o pídeme reiniciar el flujo de login), luego recarga esta página.",
  "auth.recheck": "Volver a comprobar",
  "auth.login": "Iniciar sesión en NotebookLM",
  "auth.loggingIn":
    "Se abrió una ventana del navegador — inicia sesión en Google y entra a notebooklm.google.com. Esta página lo detectará automáticamente…",
  "auth.loginError":
    "No se pudo iniciar el login por navegador (ejecuta la app localmente en Windows).",
  "auth.statusError": "No se pudo comprobar el estado del worker.",
  "auth.workerOffline":
    "La app publica esta en linea, pero el worker de Windows no esta conectado. Los jobs nuevos quedaran en cola hasta que el worker arranque.",
  "auth.workerInvalid":
    "El worker de Windows esta conectado, pero su sesion de NotebookLM no es valida. Los jobs nuevos pueden fallar hasta reautenticar el worker.",

  "hero.eyebrow": "ESTUDIO DE PODCASTS CON IA",
  "hero.titlePre": "Convierte cualquier tema en un",
  "hero.titleAccent": "podcast",
  "hero.subtitle":
    "Escribe un tema o una pregunta. NotebookLM investiga, escribe el guion y genera un podcast conversacional que puedes escuchar y compartir.",

  "gen.topicLabel": "Tema o pregunta del podcast",
  "gen.topicPlaceholder":
    "Ej: El impacto de la inteligencia artificial en la educación superior…",
  "gen.format": "Formato",
  "gen.length": "Duración",
  "gen.language": "Idioma",
  "gen.sourcesToggle": "Fuentes personalizadas (opcional)",
  "gen.sourcesLabel":
    "URLs, una por línea (hasta 10). Si lo dejas vacío, la app investigará el tema automáticamente.",
  "gen.sourcesPlaceholder":
    "https://ejemplo.com/articulo-1\nhttps://youtube.com/watch?v=…",
  "gen.submit": "Generar podcast",
  "gen.submitting": "Iniciando…",
  "gen.hint":
    "La generación tarda entre 10 y 20 minutos. Puedes cerrar esta página y volver más tarde; el podcast aparecerá en la Biblioteca.",
  "gen.errMinLength": "El tema debe tener al menos 10 caracteres.",
  "gen.connecting": "Conectando…",
  "gen.createAnother": "Crear otro",
  "gen.modeCreate": "Crear Nuevo",
  "gen.modeImport": "Importar de NotebookLM",

  "import.hasAudioTitle": "✓ Este notebook ya tiene audio",
  "import.hasAudioDesc": "El audio existente se descargará directamente (~30 segundos). Los ajustes de formato y duración serán ignorados.",
  "import.noAudioDesc": "Este notebook aún no tiene audio. Se generará con tus ajustes (~10-20 minutos).",
  "import.modeLabel": "Modo de Importación",
  "import.useExisting": "Usar Audio Existente",
  "import.generateNew": "Generar Nuevo",
  "import.selectAudio": "Seleccionar Audio",
  "import.audioWillDownload": "El audio seleccionado se descargará directamente (~30 segundos).",
  "import.willGenerate": "Se generará un nuevo audio con tus ajustes (~10-20 minutos).",
  "import.created": "Creado",

  "fmt.deep-dive": "Análisis profundo",
  "fmt.brief": "Resumen breve",
  "fmt.critique": "Crítica",
  "fmt.debate": "Debate",
  "len.short": "Corto",
  "len.default": "Normal",
  "len.long": "Largo",

  "lang.es": "Español",
  "lang.en": "Inglés",
  "lang.pt": "Portugués",
  "lang.fr": "Francés",

  "progress.generating": "Generando tu podcast…",
  "progress.done": "¡Podcast listo!",
  "progress.failed": "Falló la generación",
  "stage.queued": "En cola",
  "stage.created": "Notebook creado",
  "stage.research": "Investigando fuentes",
  "stage.generating": "Generando audio",
  "stage.downloading": "Descargando",
  "stage.done": "Publicado",
  "progress.listen": "Escuchar podcast →",

  "status.PUBLISHED": "Publicado",
  "status.GENERATING": "Generando…",
  "status.PENDING": "En cola",
  "status.FAILED": "Falló",
  "card.plays": "reproducciones",
  "action.delete": "Borrar",
  "action.retry": "Reintentar",
  "action.confirmDelete": "¿Borrar este podcast? Esta acción no se puede deshacer.",
  "action.retrying": "Reintentando…",
  "action.deleting": "Borrando…",

  "library.title": "Biblioteca",
  "library.empty": "Todavía no hay podcasts. ¡Crea el primero!",
  "library.one": "podcast",
  "library.many": "podcasts",

  "detail.back": "Biblioteca",
  "detail.plays": "reproducciones",
  "detail.failed": "Falló la generación",
  "detail.noStatus": "Sin información de estado.",
  "detail.sources": "Fuentes",
  "detail.download": "Descargar MP3",
  "detail.loading": "Cargando…",
  "detail.notFound": "Podcast no encontrado.",
};

const DICTS: Record<Lang, Dict> = { en: EN, es: ES };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "es") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("lang", l);
  };

  const t = (key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de I18nProvider");
  return ctx;
}

/** Selecciona el título del podcast según el idioma actual, con fallbacks. */
export function pickTitle(
  lang: Lang,
  p: { title: string; titleEn?: string | null; titleEs?: string | null }
): string {
  if (lang === "en") return p.titleEn || p.titleEs || p.title;
  return p.titleEs || p.titleEn || p.title;
}
