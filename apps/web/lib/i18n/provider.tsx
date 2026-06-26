"use client";

import * as React from "react";
import { Lang, TRANSLATIONS } from "./translations";

interface I18nState {
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = React.createContext<I18nState | null>(null);

const STORAGE_KEY = "refurb.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("vi");

  React.useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved === "vi" || saved === "zh-TW") setLangState(saved);
  }, []);

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
    if (typeof document !== "undefined") document.documentElement.lang = next === "zh-TW" ? "zh-Hant" : "vi";
  }, []);

  const t = React.useCallback(
    (key: string) => TRANSLATIONS[lang][key] ?? TRANSLATIONS.vi[key] ?? key,
    [lang],
  );

  const value = React.useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within <I18nProvider>");
  return ctx;
}
