"use client";

import { useI18n, type Locale } from "@/lib/i18n";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "ja", label: "JA" },
  { value: "en", label: "EN" },
  { value: "ko", label: "KO" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
      {LOCALES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setLocale(value)}
          className={[
            "rounded px-2 py-1 text-xs font-medium transition-colors",
            locale === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
          aria-pressed={locale === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
