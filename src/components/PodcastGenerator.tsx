"use client";

import { useState } from "react";
import { useSSE } from "@/hooks/useSSE";
import ProgressTracker from "./ProgressTracker";

const FORMATS = [
  { value: "deep-dive", label: "Deep Dive (análisis profundo)" },
  { value: "brief", label: "Brief (resumen breve)" },
  { value: "critique", label: "Critique (crítica)" },
  { value: "debate", label: "Debate" },
];

const LENGTHS = [
  { value: "short", label: "Corto" },
  { value: "default", label: "Normal" },
  { value: "long", label: "Largo" },
];

export default function PodcastGenerator() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("deep-dive");
  const [length, setLength] = useState("default");
  const [language, setLanguage] = useState("es");
  const [urls, setUrls] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const status = useSSE(jobId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (topic.trim().length < 10) {
      setError("El tema debe tener al menos 10 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/podcasts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          format,
          length,
          language,
          urls: urls
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al iniciar la generación");
      setJobId(data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setJobId(null);
    setTopic("");
    setUrls("");
    setError(null);
  }

  const inProgress =
    jobId && status && status.status !== "DONE" && status.status !== "FAILED";

  return (
    <div>
      {!jobId && (
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="label">Tema o pregunta del podcast</label>
            <textarea
              className="input min-h-[110px] resize-y"
              placeholder="Ej: El impacto de la inteligencia artificial en la educación superior…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
            />
            <p className="mt-1 text-right text-xs text-slate-500">
              {topic.length}/500
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Formato</label>
              <select
                className="input"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Duración</label>
              <select
                className="input"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              >
                {LENGTHS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Idioma</label>
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="es">Español</option>
                <option value="en">Inglés</option>
                <option value="pt">Portugués</option>
                <option value="fr">Francés</option>
              </select>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
              Fuentes personalizadas (opcional)
            </summary>
            <div className="mt-3">
              <label className="label">
                URLs, una por línea (hasta 10). Si lo dejas vacío, la app
                investigará el tema automáticamente.
              </label>
              <textarea
                className="input min-h-[90px] resize-y font-mono text-xs"
                placeholder="https://ejemplo.com/articulo-1&#10;https://youtube.com/watch?v=…"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
              />
            </div>
          </details>

          {error && (
            <p className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Iniciando…" : "🎙️ Generar podcast"}
          </button>
          <p className="text-xs text-slate-500">
            La generación tarda entre 10 y 20 minutos. Puedes cerrar esta página
            y volver más tarde; el podcast aparecerá en la Biblioteca.
          </p>
        </form>
      )}

      {jobId && status && <ProgressTracker status={status} />}
      {jobId && !status && (
        <div className="card mt-6 text-slate-400">Conectando…</div>
      )}

      {jobId && !inProgress && (
        <button onClick={reset} className="btn-ghost mt-4">
          ← Crear otro
        </button>
      )}
    </div>
  );
}
