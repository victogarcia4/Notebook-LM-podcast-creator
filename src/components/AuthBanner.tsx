"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type State = "checking" | "valid" | "invalid";

export default function AuthBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("checking");

  const check = useCallback(() => {
    setState("checking");
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState(d.valid ? "valid" : "invalid"))
      .catch(() => setState("invalid"));
  }, []);

  useEffect(() => {
    check();
  }, [check]);

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
        <span className="h-2 w-2 bg-[#3ddc84]" />
        <span className="text-[#3ddc84]">●</span> {t("auth.active")}
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
      <button onClick={check} className="btn-outline mt-4">
        ↻ {t("auth.recheck")}
      </button>
    </div>
  );
}
