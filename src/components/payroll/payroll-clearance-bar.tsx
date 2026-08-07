"use client";

import { Button } from "@/components/ui/button";
import { getMonthName } from "@/lib/utils";

/** Sticky Super Admin clearance strip — visible on mobile without digging to wizard step 4. */
export function PayrollClearanceBar({
  periodMonth,
  periodYear,
  loading,
  onApprove,
  onReject,
}: {
  periodMonth: number;
  periodYear: number;
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-30 -mx-4 mb-5 border-b border-amber-200 bg-amber-50/95 px-4 py-3 shadow-soft backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-xl lg:border lg:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">
            Clearance needed — {getMonthName(periodMonth)} {periodYear}
          </p>
          <p className="text-xs text-stone-600">
            HR submitted this run. Approve to lock figures or send it back.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={loading}
            className="min-h-10 flex-1 sm:flex-none"
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={loading}
            className="min-h-10 flex-1 sm:flex-none"
          >
            Send back
          </Button>
        </div>
      </div>
    </div>
  );
}
