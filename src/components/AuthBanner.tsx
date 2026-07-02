"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type State = "checking" | "valid" | "invalid" | "loggingIn";
type AuthStatus = {
  valid: boolean;
  source?: "local" | "worker";
  workerOnline?: boolean;
  message?: string | null;
  lastSeenAt?: string | null;
};

export default function AuthBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("checking");
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const check = useCallback(async (): Promise<AuthStatus> => {
    try {
      const r = await fetch("/api/auth/status", { cache: "no-store" });
      const d = await r.json();
      const next = {
        valid: !!d.valid,
        source: d.source,
        workerOnline: d.workerOnline,
        message: d.message,
        lastSeenAt: d.lastSeenAt,
      };
      setStatus(next);
      return next;
    } catch {
      const next = {
        valid: false,
        workerOnline: false,
        message: t("auth.statusError"),
      };
      setStatus(next);
      return next;
    }
  }, [t]);

  const runCheck = useCallback(() => {
    setState("checking");
    check().then((d) => setState(d.valid ? "valid" : "invalid"));
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

    setState("loggingIn");
    let elapsed = 0;
    stopPolling();
    pollRef.current = setInterval(async () => {
      elapsed += 4;
      const d = await check();
      if (d.valid) {
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
        <span className="text-[#3ddc84]">*</span> {t("auth.active")}
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

  return (
    <div className="mb-6 border-2 border-accent bg-accent/10 p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-accent">
          ! {t("auth.expiredTitle")}
        </span>
      </div>
      <p className="text-sm text-fg">
        {status?.source === "worker" && status.workerOnline === false
          ? t("auth.workerOffline")
          : status?.source === "worker"
            ? t("auth.workerInvalid")
            : t("auth.expiredBody")}
      </p>
      <p className="mt-2 font-mono text-xs text-dim">
        {status?.message || t("auth.howto")}
      </p>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {status?.source !== "worker" && (
          <button onClick={handleLogin} className="btn-primary">
            -&gt; {t("auth.login")}
          </button>
        )}
        <button onClick={runCheck} className="btn-outline">
          Refresh {t("auth.recheck")}
        </button>
      </div>
    </div>
  );
}
