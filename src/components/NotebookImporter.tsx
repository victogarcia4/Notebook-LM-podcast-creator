"use client";

import { useState, useEffect } from "react";
import type { NotebookSummary, AudioArtifact } from "@/lib/notebooklm/client";
import { NotebookCard } from "./NotebookCard";
import { useI18n } from "@/lib/i18n";

interface NotebookWithAudios extends NotebookSummary {
  hasAudio?: boolean;
  audios?: AudioArtifact[];
}

interface Props {
  onJobCreated: (jobId: string) => void;
}

export function NotebookImporter({ onJobCreated }: Props) {
  const { t } = useI18n();
  const [notebooks, setNotebooks] = useState<NotebookWithAudios[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"existing" | "generate">("existing");
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [format, setFormat] = useState("deep-dive");
  const [length, setLength] = useState("default");
  const [language, setLanguage] = useState("es");
  const [importing, setImporting] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    fetchNotebooks();
  }, []);

  // Auto-select import mode and audio when notebook changes
  useEffect(() => {
    if (!selectedNotebook) return;

    const selectedNb = notebooks.find((nb) => nb.id === selectedNotebook);
    const audios = selectedNb?.audios ?? [];

    if (audios.length > 0) {
      setImportMode("existing");
      // Auto-select first audio if only one exists
      if (audios.length === 1) {
        setSelectedAudioId(audios[0].id);
      } else {
        setSelectedAudioId(null);
      }
    } else {
      setImportMode("generate");
      setSelectedAudioId(null);
    }
  }, [selectedNotebook, notebooks]);

  async function fetchNotebooks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notebooks");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load notebooks");
      }
      const data = await res.json();
      setNotebooks(data.notebooks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    setLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed");
        setLoggingIn(false);
        return;
      }

      // Poll for auth status every 4 seconds
      let elapsed = 0;
      const pollInterval = setInterval(async () => {
        elapsed += 4;
        try {
          const statusRes = await fetch("/api/auth/status", { cache: "no-store" });
          const statusData = await statusRes.json();

          if (statusData.valid) {
            clearInterval(pollInterval);
            setLoggingIn(false);
            // Auto-retry fetching notebooks
            fetchNotebooks();
          } else if (elapsed >= 300) {
            // Timeout after 5 minutes
            clearInterval(pollInterval);
            setLoggingIn(false);
            setError("Login timeout. Please try again.");
          }
        } catch {
          // Continue polling
        }
      }, 4000);
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoggingIn(false);
    }
  }

  async function handleImport() {
    if (!selectedNotebook) return;

    // Find the selected notebook to get its title and description
    const notebook = notebooks.find((nb) => nb.id === selectedNotebook);
    if (!notebook) return;

    // Validate: if mode is "existing", must have selected an audioId
    if (importMode === "existing" && !selectedAudioId) {
      setError("Please select an audio file");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/podcasts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId: selectedNotebook,
          title: notebook.title,
          topic: notebook.description || notebook.title,
          importMode,
          audioId: importMode === "existing" ? selectedAudioId : null,
          format,
          length,
          language,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to import");
      }

      const data = await res.json();
      onJobCreated(data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="card text-center text-dim">
        <div className="animate-pulse">Loading notebooks...</div>
      </div>
    );
  }

  if (loggingIn) {
    return (
      <div className="card border-yellow-500 bg-yellow-500/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 animate-pulse bg-yellow-500" />
          <p className="font-mono text-xs uppercase tracking-widest text-yellow-500">
            LOGGING IN
          </p>
        </div>
        <p className="text-sm text-dim">
          A browser window has opened. Please complete the NotebookLM login and
          return here. Waiting for authentication...
        </p>
      </div>
    );
  }

  if (error) {
    // Detect if this is an authentication error
    const isAuthError = error.toLowerCase().includes("session") ||
                        error.toLowerCase().includes("expired") ||
                        error.toLowerCase().includes("authenticate");

    return (
      <div className="card border-red-500 bg-red-500/10">
        <p className="text-red-500 mb-4">{error}</p>
        <div className="flex gap-2">
          {isAuthError && (
            <button className="btn-primary" onClick={handleLogin}>
              → LOGIN TO NOTEBOOKLM
            </button>
          )}
          <button className="btn-outline" onClick={fetchNotebooks}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (notebooks.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-dim">No notebooks found.</p>
        <p className="text-sm text-mute mt-2">
          Create one in{" "}
          <a
            href="https://notebooklm.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            NotebookLM
          </a>{" "}
          first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display text-xl mb-4">Select Notebook</h3>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {notebooks.map((nb) => (
          <NotebookCard
            key={nb.id}
            notebook={nb}
            selected={selectedNotebook === nb.id}
            onClick={() => setSelectedNotebook(nb.id)}
          />
        ))}
      </div>

      {selectedNotebook && (
        <div className="card">
          <h3 className="font-display text-lg mb-4">Import Settings</h3>

          {(() => {
            const selectedNb = notebooks.find((nb) => nb.id === selectedNotebook);
            const audios = selectedNb?.audios ?? [];
            const hasAudio = audios.length > 0;

            return (
              <>
                {/* Mode selector - only show if notebook has audio */}
                {hasAudio && (
                  <div className="mb-4">
                    <label className="label">{t("import.modeLabel")}</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={importMode === "existing" ? "btn-primary" : "btn-outline"}
                        onClick={() => setImportMode("existing")}
                      >
                        {t("import.useExisting")} ({audios.length})
                      </button>
                      <button
                        type="button"
                        className={importMode === "generate" ? "btn-primary" : "btn-outline"}
                        onClick={() => setImportMode("generate")}
                      >
                        {t("import.generateNew")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Audio selector - show when mode is "existing" */}
                {importMode === "existing" && hasAudio && (
                  <div className="mb-4">
                    <label className="label">{t("import.selectAudio")}</label>
                    <div className="space-y-2">
                      {audios.map((audio) => (
                        <button
                          key={audio.id}
                          type="button"
                          className={`w-full text-left p-3 border rounded transition-all ${
                            selectedAudioId === audio.id
                              ? "border-accent bg-accent/10"
                              : "border-line hover:border-line-strong"
                          }`}
                          onClick={() => setSelectedAudioId(audio.id)}
                        >
                          <div className="font-medium">{audio.title}</div>
                          {audio.createdAt && (
                            <div className="text-xs text-mute mt-1">
                              {t("import.created")}: {new Date(audio.createdAt).toLocaleString()}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-dim mt-2">
                      {t("import.audioWillDownload")}
                    </p>
                  </div>
                )}

                {/* Format/Length/Language - show when mode is "generate" or no audio */}
                {importMode === "generate" && (
                  <>
                    <div className="mb-4 p-3 border border-line bg-bg-subtle rounded">
                      <p className="text-sm text-dim">
                        {t("import.willGenerate")}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="label">Format</label>
                        <select
                          className="input"
                          value={format}
                          onChange={(e) => setFormat(e.target.value)}
                        >
                          <option value="deep-dive">Deep Dive</option>
                          <option value="brief">Brief</option>
                          <option value="critique">Critique</option>
                          <option value="debate">Debate</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">Length</label>
                        <select
                          className="input"
                          value={length}
                          onChange={(e) => setLength(e.target.value)}
                        >
                          <option value="short">Short</option>
                          <option value="default">Normal</option>
                          <option value="long">Long</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">Language</label>
                        <select
                          className="input"
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                        >
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="pt">Português</option>
                          <option value="fr">Français</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="mt-4 p-3 border border-red-500 bg-red-500/10 rounded">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <button
                  className="btn-primary mt-6 w-full"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? "Importing..." : "Import Podcast"}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
