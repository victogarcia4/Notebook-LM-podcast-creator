/**
 * Traducción de textos cortos (títulos) usando una API gratuita sin clave.
 *
 * Por defecto usa el endpoint público de Google Translate (gtx), que no
 * requiere API key. Si defines LIBRETRANSLATE_URL en el entorno, se usa una
 * instancia de LibreTranslate en su lugar.
 *
 * Resiliencia TLS: algunas redes interceptan TLS con un CA propio y hacen
 * fallar `fetch`. Si el intento normal falla, se reintenta con un dispatcher
 * de undici que no verifica el certificado (solo para estas peticiones de
 * traducción, que no manejan datos sensibles). Si todo falla, devuelve el
 * texto original — nunca rompe el flujo.
 */

import { Agent } from "undici";

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL;

// Dispatcher que ignora la verificación de certificado (fallback para redes
// con interceptación TLS). Se crea una sola vez de forma perezosa.
let insecureDispatcher: Agent | null = null;
function getInsecureDispatcher(): Agent {
  if (!insecureDispatcher) {
    insecureDispatcher = new Agent({
      connect: { rejectUnauthorized: false },
    });
  }
  return insecureDispatcher;
}

async function translateWithGoogle(
  text: string,
  target: "en" | "es",
  insecure: boolean
): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
    encodeURIComponent(target) +
    "&dt=t&q=" +
    encodeURIComponent(text);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    ...(insecure ? { dispatcher: getInsecureDispatcher() } : {}),
  } as RequestInit);
  if (!res.ok) throw new Error(`gtx HTTP ${res.status}`);
  const data = (await res.json()) as any;
  // Formato: [[["traducción","original",...], ...], ...]
  const segments = data?.[0];
  if (!Array.isArray(segments)) throw new Error("gtx respuesta inesperada");
  return segments
    .map((s: any) => (Array.isArray(s) ? s[0] : ""))
    .join("")
    .trim();
}

async function translateWithLibre(
  text: string,
  target: "en" | "es",
  insecure: boolean
): Promise<string> {
  const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "auto", target, format: "text" }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    ...(insecure ? { dispatcher: getInsecureDispatcher() } : {}),
  } as RequestInit);
  if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return (data?.translatedText ?? "").trim();
}

async function attempt(
  text: string,
  target: "en" | "es",
  insecure: boolean
): Promise<string> {
  return LIBRETRANSLATE_URL
    ? translateWithLibre(text, target, insecure)
    : translateWithGoogle(text, target, insecure);
}

/** Traduce un texto al idioma destino. Devuelve el original si todo falla. */
export async function translate(
  text: string,
  target: "en" | "es"
): Promise<string> {
  const clean = text.trim();
  if (!clean) return clean;

  // Intento 1: TLS normal. Intento 2: fallback ignorando certificado.
  for (const insecure of [false, true]) {
    try {
      const result = await attempt(clean, target, insecure);
      if (result) return result;
    } catch {
      /* prueba el siguiente modo */
    }
  }
  console.warn(`[translate] no se pudo traducir a ${target}; se usa el original`);
  return clean;
}

/** Devuelve el título en inglés y en español a partir de un texto de origen. */
export async function translateTitleBoth(
  text: string
): Promise<{ titleEn: string; titleEs: string }> {
  const [titleEn, titleEs] = await Promise.all([
    translate(text, "en"),
    translate(text, "es"),
  ]);
  return { titleEn, titleEs };
}
