"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunPayrollCta({ label }: { label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const now = new Date();
    const res = await fetch("/api/payroll/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        applyAttendancePenalties: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      if (typeof data.error === "string" && data.error.toLowerCase().includes("already")) {
        router.push("/payroll");
        return;
      }
      alert(data.error ?? "Could not start payroll");
      return;
    }
    router.push(`/payroll/${data.id}`);
  }

  return (
    <Button
      onClick={() => void start()}
      disabled={loading}
      variant="brand"
      className="w-full sm:w-auto"
    >
      {loading ? "Starting…" : label}
    </Button>
  );
}
