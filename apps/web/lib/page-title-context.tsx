"use client";

import * as React from "react";

interface PageTitleState {
  title: string;
  subtitle: string;
  setTitle: (title: string) => void;
  setSubtitle: (subtitle: string) => void;
  setPageMeta: (meta: { title: string; subtitle: string }) => void;
}

const DEFAULT_TITLE = "Dashboard";
const DEFAULT_SUBTITLE = "Tổng quan hoạt động cửa hàng";

const PageTitleContext = React.createContext<PageTitleState | null>(null);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = React.useState<string>(DEFAULT_TITLE);
  const [subtitle, setSubtitle] = React.useState<string>(DEFAULT_SUBTITLE);

  const setPageMeta = React.useCallback(
    (meta: { title: string; subtitle: string }) => {
      setTitle(meta.title);
      setSubtitle(meta.subtitle);
    },
    [],
  );

  const value = React.useMemo(
    () => ({ title, subtitle, setTitle, setSubtitle, setPageMeta }),
    [title, subtitle, setPageMeta],
  );

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  const ctx = React.useContext(PageTitleContext);
  if (!ctx) {
    return {
      title: DEFAULT_TITLE,
      subtitle: DEFAULT_SUBTITLE,
      setTitle: () => {},
      setSubtitle: () => {},
      setPageMeta: () => {},
    } satisfies PageTitleState;
  }
  return ctx;
}

export function usePageMeta(title: string, subtitle: string) {
  const { setPageMeta } = usePageTitle();
  React.useEffect(() => {
    setPageMeta({ title, subtitle });
  }, [title, subtitle, setPageMeta]);
}
