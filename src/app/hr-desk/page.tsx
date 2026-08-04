import { Suspense } from "react";
import HrDeskClient from "./hr-desk-client";

export const dynamic = "force-dynamic";

export default function HrDeskPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-sm text-stone-500">Loading HR Desk…</p>
      }
    >
      <HrDeskClient />
    </Suspense>
  );
}
