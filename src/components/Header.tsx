"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import LanguageToggle from "./LanguageToggle";

export default function Header() {
  const { t } = useI18n();
  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center font-display text-lg text-black"
            style={{ background: "var(--accent)" }}
          >
            N
          </span>
          <span className="font-display text-lg tracking-tight">
            Notebook LM Podcast Creator
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="btn-outline">
            {t("nav.create")}
          </Link>
          <Link href="/library" className="btn-outline">
            {t("nav.library")}
          </Link>
          <LanguageToggle />
        </div>
      </nav>
    </header>
  );
}
