"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import {
  brandToCssVars,
  type CompanyBrand,
} from "@/lib/company-brand";

type BrandContextValue = {
  brand: CompanyBrand | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BrandContext = createContext<BrandContextValue>({
  brand: null,
  loading: true,
  refresh: async () => {},
});

function applyCssVars(brand: CompanyBrand | null) {
  const root = document.documentElement;
  if (!brand) return;
  const vars = brandToCssVars(brand);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function CompanyBrandProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const [brand, setBrand] = useState<CompanyBrand | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setBrand(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/company/brand");
      if (!res.ok) {
        setBrand(null);
        return;
      }
      const data = (await res.json()) as CompanyBrand;
      setBrand(data);
      applyCssVars(data);
    } catch {
      setBrand(null);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ brand, loading, refresh }),
    [brand, loading, refresh]
  );

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

export function useCompanyBrand() {
  return useContext(BrandContext);
}
