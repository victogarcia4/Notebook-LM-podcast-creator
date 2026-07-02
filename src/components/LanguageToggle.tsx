"use client";

import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center border border-line-strong font-mono text-xs uppercase tracking-widest">
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1.5 transition-colors ${
          lang === "en" ? "bg-fg text-black" : "text-dim hover:text-fg"
        }`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        onClick={() => setLang("es")}
        className={`px-3 py-1.5 transition-colors ${
          lang === "es" ? "bg-fg text-black" : "text-dim hover:text-fg"
        }`}
        aria-pressed={lang === "es"}
      >
        ES
      </button>
    </div>
  );
}
