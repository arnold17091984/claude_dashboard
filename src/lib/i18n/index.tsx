"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { type Locale, translations } from "./translations";

export type { Locale };

const STORAGE_KEY = "locale";
const DEFAULT_LOCALE: Locale = "ja";

type Vars = Record<string, string | number>;

function translate(locale: Locale, key: string, vars?: Vars): string {
  const map = translations[locale];
  let str = map[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}

function getDateLocale(locale: Locale): string {
  switch (locale) {
    case "en":
      return "en-US";
    case "ko":
      return "ko-KR";
    default:
      return "ja-JP";
  }
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Vars) => string;
  dateLocale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in translations) {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang =
      l === "ja" ? "ja" : l === "ko" ? "ko" : "en";
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => translate(locale, key, vars),
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, dateLocale: getDateLocale(locale) }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
