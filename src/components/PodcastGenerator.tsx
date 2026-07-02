"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSSE } from "@/hooks/useSSE";
import ProgressTracker from "./ProgressTracker";

const FORMATS = ["deep-dive", "brief", "critique", "debate"];
const LENGTHS = ["short", "default", "long"];
const LANGS = ["en", "es", "pt", "fr"];

export default function PodcastGenerator() {
  const { t } = useI18n();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("deep-dive");
  const [length, setLength] = useState("default");
  const [language, setLanguage] = useState("en");
  const [urls, setUrls] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const status = useSSE(jobId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (topic.trim().length < 10) {
      setError(t("gen.errMinLength"));
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
      if (!res.ok) throw new Error(data.error || "Error");
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
            <label className="label">{t("gen.topicLabel")}</label>
            <textarea
              className="input min-h-[110px] resize-y"
              placeholder={t("gen.topicPlaceholder")}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
            />
            <p className="mt-1 text-right font-mono text-xs text-mute">
              {topic.length}/500
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">{t("gen.format")}</label>
              <select
                className="input"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {t(`fmt.${f}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("gen.length")}</label>
              <select
                className="input"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              >
                {LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {t(`len.${l}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("gen.language")}</label>
              <select
                className="input"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {t(`lang.${l}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-dim hover:text-fg">
              {t("gen.sourcesToggle")}
            </summary>
            <div className="mt-3">
              <label className="label">{t("gen.sourcesLabel")}</label>
              <textarea
                className="input min-h-[90px] resize-y font-mono text-xs"
                placeholder={t("gen.sourcesPlaceholder")}
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
              />
            </div>
          </details>

          {error && (
            <p className="border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? t("gen.submitting") : t("gen.submit")}
          </button>
          <p className="text-xs text-mute">{t("gen.hint")}</p>
        </form>
      )}

      {jobId && status && <ProgressTracker status={status} />}
      {jobId && !status && (
        <div className="card mt-6 text-dim">{t("gen.connecting")}</div>
      )}

      {jobId && !inProgress && (
        <button onClick={reset} className="btn-outline mt-4">
          ← {t("gen.createAnother")}
        </button>
      )}
    </div>
  );
}
