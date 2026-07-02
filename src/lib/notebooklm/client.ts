import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const NLM_PATH = path.normalize(
  (
    process.env.NLM_PATH ||
    "C:/Users/skint/.notebooklm-venv/Scripts/notebooklm.exe"
  ).trim()
);

// Timeout amplio: la generación de audio puede tardar 10-20 min.
const DEFAULT_TIMEOUT_MS = 25 * 60 * 1000;

export interface NlmResult {
  stdout: string;
  stderr: string;
}

/**
 * Ejecuta el CLI de NotebookLM con los argumentos dados.
 * Antepone --quiet para que stdout quede limpio para parsear JSON.
 */
export async function runNlm(
  args: string[],
  opts: { timeoutMs?: number } = {}
): Promise<NlmResult> {
  const fullArgs = ["--quiet", ...args];
  try {
    const { stdout, stderr } = await execFileAsync(NLM_PATH, fullArgs, {
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (err: any) {
    const detail =
      err?.stderr?.toString().trim() ||
      err?.stdout?.toString().trim() ||
      err?.message ||
      "error desconocido";
    throw new Error(`NotebookLM CLI falló (${args.join(" ")}): ${detail}`);
  }
}

/** Ejecuta un comando con --json y devuelve el objeto parseado. */
export async function runNlmJson<T = any>(
  args: string[],
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  const { stdout } = await runNlm([...args, "--json"], opts);
  return parseJsonLoose<T>(stdout);
}

/**
 * Extrae el primer bloque JSON válido de la salida (por si el CLI antepone
 * alguna línea de estado a pesar de --quiet).
 */
function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.search(/[{[]/);
    if (start >= 0) {
      const candidate = trimmed.slice(start);
      return JSON.parse(candidate) as T;
    }
    throw new Error(`No se pudo parsear JSON del CLI: ${trimmed.slice(0, 300)}`);
  }
}

/** Verifica que la sesión de NotebookLM sigue autenticada. */
export async function authCheck(): Promise<boolean> {
  try {
    await runNlm(["auth", "check"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Comprueba el estado REAL de la sesión con `auth check --test` (hace una
 * llamada de token real). Captura la salida aunque el CLI termine con código
 * distinto de cero, y decide validez según el texto.
 */
export async function authStatus(): Promise<{ valid: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      NLM_PATH,
      ["--quiet", "auth", "check", "--test"],
      { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
    );
    return { valid: isAuthOutputValid((stdout ?? "") + (stderr ?? "")) };
  } catch (err: any) {
    const out = (err?.stdout?.toString() ?? "") + (err?.stderr?.toString() ?? "");
    return { valid: isAuthOutputValid(out) };
  }
}

function isAuthOutputValid(output: string): boolean {
  const text = output.toLowerCase();
  if (
    text.includes("token fetch failed") ||
    text.includes("expired or invalid") ||
    text.includes("run 'notebooklm login'")
  ) {
    return false;
  }
  // Válida solo si la prueba de token pasó explícitamente.
  return text.includes("authentication is valid") || text.includes("token fetch");
}

/** Crea un notebook y devuelve su id. */
export async function createNotebook(title: string): Promise<string> {
  const data = await runNlmJson<any>(["create", title]);
  const id = extractNotebookId(data);
  if (!id) {
    throw new Error(
      `No se encontró el id del notebook en la respuesta: ${JSON.stringify(data).slice(0, 300)}`
    );
  }
  return id;
}

function extractNotebookId(data: any): string | null {
  if (!data) return null;
  if (typeof data.id === "string") return data.id;
  if (data.notebook?.id) return data.notebook.id;
  if (data.notebook_id) return data.notebook_id;
  if (Array.isArray(data.notebooks) && data.notebooks[0]?.id)
    return data.notebooks[0].id;
  return null;
}

/** Añade una URL como fuente al notebook. */
export async function addUrlSource(
  notebookId: string,
  url: string
): Promise<void> {
  await runNlmJson(["source", "add", url, "-n", notebookId], {
    timeoutMs: 3 * 60 * 1000,
  });
}

/**
 * Investiga en la web sobre el tema e importa las fuentes encontradas.
 * Por defecto espera a que termine (modo fast).
 */
export async function addResearch(
  notebookId: string,
  query: string
): Promise<void> {
  await runNlmJson(
    ["source", "add-research", query, "-n", notebookId, "--import-all"],
    { timeoutMs: 20 * 60 * 1000 }
  );
}

export interface NlmSource {
  id: string;
  title?: string;
  status?: string;
}

/** Lista las fuentes del notebook. */
export async function listSources(notebookId: string): Promise<NlmSource[]> {
  const data = await runNlmJson<any>(["source", "list", "-n", notebookId]);
  const sources = data?.sources ?? data ?? [];
  return Array.isArray(sources) ? sources : [];
}

/** Espera (con sondeo) a que todas las fuentes estén en estado ready. */
export async function waitSourcesReady(
  notebookId: string,
  { timeoutMs = 5 * 60 * 1000, intervalMs = 5000 } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sources = await listSources(notebookId);
    if (sources.length === 0) {
      await sleep(intervalMs);
      continue;
    }
    const allReady = sources.every((s) => {
      const st = (s.status || "").toLowerCase();
      return st === "ready" || st === "enabled" || st === "";
    });
    if (allReady) return;
    await sleep(intervalMs);
  }
  // No lanzamos error: intentamos generar de todas formas.
}

export interface GenerateAudioOpts {
  format?: string; // deep-dive | brief | critique | debate
  length?: string; // short | default | long
  language?: string;
  instructions?: string;
  retry?: number;
}

/**
 * Genera el podcast (audio overview) y espera a que termine (--wait).
 * Devuelve la respuesta cruda del CLI.
 */
export async function generateAudio(
  notebookId: string,
  opts: GenerateAudioOpts = {}
): Promise<any> {
  const args = ["generate", "audio"];
  if (opts.instructions) args.push(opts.instructions);
  args.push("-n", notebookId, "--wait");
  if (opts.format) args.push("--format", opts.format);
  if (opts.length) args.push("--length", opts.length);
  if (opts.language) args.push("--language", opts.language);
  args.push("--retry", String(opts.retry ?? 2));
  return runNlmJson<any>(args, { timeoutMs: DEFAULT_TIMEOUT_MS });
}

/** Descarga el audio más reciente del notebook a la ruta indicada. */
export async function downloadAudio(
  notebookId: string,
  outPath: string
): Promise<void> {
  await runNlmJson(
    ["download", "audio", outPath, "-n", notebookId, "--latest", "--force"],
    { timeoutMs: 5 * 60 * 1000 }
  );
}
