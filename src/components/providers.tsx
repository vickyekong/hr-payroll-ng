"use client";

import { SessionProvider } from "next-auth/react";
import { CompanyBrandProvider } from "@/components/brand/company-brand-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CompanyBrandProvider>{children}</CompanyBrandProvider>
    </SessionProvider>
  );
}
