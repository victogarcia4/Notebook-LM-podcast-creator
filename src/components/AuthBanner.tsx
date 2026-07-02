"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type State = "checking" | "valid" | "invalid" | "loggingIn";

export default function AuthBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/auth/status", { cache: "no-store" });
      const d = await r.json();
      return !!d.valid;
    } catch {
      return false;
    }
  }, []);

  const runCheck = useCallback(() => {
    setState("checking");
    check().then((valid) => setState(valid ? "valid" : "invalid"));
  }, [check]);

  useEffect(() => {
    runCheck();
    return stopPolling;
  }, [runCheck]);

  async function handleLogin() {
    setError(null);
    try {
      const r = await fetch("/api/auth/login", { method: "POST" });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || t("auth.loginError"));
        return;
      }
    } catch {
      setError(t("auth.loginError"));
      return;
    }

    // Sondea el estado real hasta que la sesión sea válida (o ~5 min).
    setState("loggingIn");
    let elapsed = 0;
    stopPolling();
    pollRef.current = setInterval(async () => {
      elapsed += 4;
      const valid = await check();
      if (valid) {
        stopPolling();
        setState("valid");
      } else if (elapsed >= 300) {
        stopPolling();
        setState("invalid");
      }
    }, 4000);
  }

  if (state === "checking") {
    return (
      <div className="mb-6 flex items-center gap-2 border border-line bg-elevated px-4 py-3 font-mono text-xs uppercase tracking-widest text-dim">
        <span className="h-2 w-2 animate-pulse bg-dim" />
        {t("auth.checking")}
      </div>
    );
  }

  if (state === "valid") {
    return (
      <div className="mb-6 flex items-center gap-2 border border-line px-4 py-3 font-mono text-xs uppercase tracking-widest text-dim">
        <span className="text-[#3ddc84]">●</span> {t("auth.active")}
      </div>
    );
  }

  if (state === "loggingIn") {
    return (
      <div className="mb-6 border-2 border-yellow bg-yellow/10 p-5">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-yellow">
          <span className="h-2 w-2 animate-pulse bg-yellow" />
          {t("auth.login")}
        </div>
        <p className="text-sm text-fg">{t("auth.loggingIn")}</p>
      </div>
    );
  }

  // invalid
  return (
    <div className="mb-6 border-2 border-accent bg-accent/10 p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-accent">
          ⚠ {t("auth.expiredTitle")}
        </span>
      </div>
      <p className="text-sm text-fg">{t("auth.expiredBody")}</p>
      <p className="mt-2 font-mono text-xs text-dim">{t("auth.howto")}</p>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={handleLogin} className="btn-primary">
          → {t("auth.login")}
        </button>
        <button onClick={runCheck} className="btn-outline">
          ↻ {t("auth.recheck")}
        </button>
      </div>
    </div>
  );
}
