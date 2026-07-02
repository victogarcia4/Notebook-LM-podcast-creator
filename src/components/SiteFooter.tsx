"use client";

import { useI18n } from "@/lib/i18n";

export default function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center">
        <div className="flex items-center gap-3">
          {/* Foto del autor (public/VHGM pic foto.PNG) */}
          <img
            src="/VHGM%20pic%20foto.PNG"
            alt="Dr. Victor Garcia M"
            className="h-12 w-12 rounded-full border border-line-strong object-cover"
          />
          <div className="text-left">
            <p className="font-display text-base leading-tight">
              {t("footer.builtBy")}
            </p>
            <p className="font-mono text-xs uppercase tracking-widest text-dim">
              {t("footer.tag")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
