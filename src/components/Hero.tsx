"use client";

import { useI18n } from "@/lib/i18n";

export default function Hero() {
  const { t } = useI18n();
  return (
    <section className="mb-10">
      <span className="eyebrow mb-5">{t("hero.eyebrow")}</span>
      <h1 className="font-display text-5xl sm:text-6xl">
        {t("hero.titlePre")}{" "}
        <span style={{ color: "var(--accent)" }}>{t("hero.titleAccent")}</span>
      </h1>
      <p className="mt-5 max-w-2xl text-dim">{t("hero.subtitle")}</p>
    </section>
  );
}
