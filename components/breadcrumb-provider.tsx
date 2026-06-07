"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BreadcrumbTitleContextValue = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const BreadcrumbTitleContext =
  createContext<BreadcrumbTitleContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <BreadcrumbTitleContext.Provider value={value}>
      {children}
    </BreadcrumbTitleContext.Provider>
  );
}

export function useBreadcrumbTitle() {
  return useContext(BreadcrumbTitleContext)?.title ?? null;
}

/** Set judul segmen terakhir breadcrumb dari halaman client. */
export function SetBreadcrumbTitle({ title }: { title: string | null }) {
  const ctx = useContext(BreadcrumbTitleContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setTitle(title);
    return () => ctx.setTitle(null);
  }, [title, ctx]);

  return null;
}
