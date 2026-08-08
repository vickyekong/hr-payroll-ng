"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TaxBandForm {
  lowerBoundNaira: number;
  upperBoundNaira: number | null;
  ratePercent: number;
}

interface SettingsData {
  companyName: string;
  statutory: {
    pensionEmployeeRate: number;
    pensionEmployerRate: number;
    nhfEnabled: boolean;
    nhfRate: number;
    nsitfRate: number;
    taxReliefMode: "NTA2025" | "CRA";
    taxFreeThresholdNaira: number;
    minimumWageExemptNaira: number;
    rentReliefCapNaira: number;
    workingDaysPerMonth?: number;
  } | null;
  taxBands: TaxBandForm[];
}

const defaultBands: TaxBandForm[] = [
  { lowerBoundNaira: 0, upperBoundNaira: 800_000, ratePercent: 0 },
  { lowerBoundNaira: 800_000, upperBoundNaira: 3_000_000, ratePercent: 15 },
  { lowerBoundNaira: 3_000_000, upperBoundNaira: 12_000_000, ratePercent: 18 },
  { lowerBoundNaira: 12_000_000, upperBoundNaira: 25_000_000, ratePercent: 21 },
  { lowerBoundNaira: 25_000_000, upperBoundNaira: 50_000_000, ratePercent: 23 },
  { lowerBoundNaira: 50_000_000, upperBoundNaira: null, ratePercent: 25 },
];

export function SettingsForm() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data?.statutory) return;

    setLoading(true);
    setMessage("");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pensionEmployeeRate: Number(form.get("pensionEmployeeRate")),
        pensionEmployerRate: Number(form.get("pensionEmployerRate")),
        nhfEnabled: form.get("nhfEnabled") === "on",
        nhfRate: Number(form.get("nhfRate")),
        nsitfRate: Number(form.get("nsitfRate")),
        taxReliefMode: form.get("taxReliefMode"),
        taxFreeThresholdNaira: Number(form.get("taxFreeThresholdNaira")),
        minimumWageExemptNaira: Number(form.get("minimumWageExemptNaira")),
        rentReliefCapNaira: Number(form.get("rentReliefCapNaira")),
        workingDaysPerMonth: Number(form.get("workingDaysPerMonth")),
        taxBands: data.taxBands,
      }),
    });

    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      setData(updated);
      setMessage("Settings saved.");
    } else {
      const err = await res.json();
      setMessage(err.error ?? "Failed to save");
    }
  }

  function updateBand(index: number, field: keyof TaxBandForm, value: string) {
    if (!data) return;
    const bands = [...data.taxBands];
    const band = { ...bands[index] };
    if (field === "upperBoundNaira") {
      band.upperBoundNaira = value === "" ? null : Number(value);
    } else if (field === "lowerBoundNaira") {
      band.lowerBoundNaira = Number(value);
    } else {
      band.ratePercent = Number(value);
    }
    bands[index] = band;
    setData({ ...data, taxBands: bands });
  }

  function resetBandsToNta2025() {
    if (!data) return;
    setData({ ...data, taxBands: defaultBands });
  }

  if (!data) {
    return <p className="text-stone-500">Loading settings…</p>;
  }

  const s = data.statutory ?? {
    pensionEmployeeRate: 8,
    pensionEmployerRate: 10,
    nhfEnabled: true,
    nhfRate: 2.5,
    nsitfRate: 1,
    taxReliefMode: "NTA2025" as const,
    taxFreeThresholdNaira: 800_000,
    minimumWageExemptNaira: 840_000,
    rentReliefCapNaira: 500_000,
    workingDaysPerMonth: 22,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Statutory rates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pensionEmployeeRate">Pension — employee (%)</Label>
            <Input
              id="pensionEmployeeRate"
              name="pensionEmployeeRate"
              type="number"
              step="0.01"
              defaultValue={s.pensionEmployeeRate}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pensionEmployerRate">Pension — employer (%)</Label>
            <Input
              id="pensionEmployerRate"
              name="pensionEmployerRate"
              type="number"
              step="0.01"
              defaultValue={s.pensionEmployerRate}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="nhfRate">NHF rate (%)</Label>
            <Input
              id="nhfRate"
              name="nhfRate"
              type="number"
              step="0.01"
              defaultValue={s.nhfRate}
              className="mt-1"
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <input
              id="nhfEnabled"
              name="nhfEnabled"
              type="checkbox"
              defaultChecked={s.nhfEnabled}
              className="h-4 w-4"
            />
            <Label htmlFor="nhfEnabled">NHF enabled</Label>
          </div>
          <div>
            <Label htmlFor="nsitfRate">NSITF — employer (%)</Label>
            <Input
              id="nsitfRate"
              name="nsitfRate"
              type="number"
              step="0.01"
              defaultValue={s.nsitfRate}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="taxReliefMode">Tax relief mode</Label>
            <select
              id="taxReliefMode"
              name="taxReliefMode"
              defaultValue={s.taxReliefMode}
              className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
            >
              <option value="NTA2025">NTA 2025 (0% band + rent relief)</option>
              <option value="CRA">Legacy CRA</option>
            </select>
          </div>
          <div>
            <Label htmlFor="taxFreeThresholdNaira">
              CRA tax-free threshold (₦/year)
            </Label>
            <Input
              id="taxFreeThresholdNaira"
              name="taxFreeThresholdNaira"
              type="number"
              defaultValue={s.taxFreeThresholdNaira}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-stone-500">
              Used only in CRA relief mode. Under NTA 2025, the ₦800k personal
              allowance is the 0% tax band — not stacked as extra relief.
            </p>
          </div>
          <div>
            <Label htmlFor="minimumWageExemptNaira">Min wage exempt (₦/year)</Label>
            <Input
              id="minimumWageExemptNaira"
              name="minimumWageExemptNaira"
              type="number"
              defaultValue={s.minimumWageExemptNaira}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="rentReliefCapNaira">Rent relief cap (₦/year)</Label>
            <Input
              id="rentReliefCapNaira"
              name="rentReliefCapNaira"
              type="number"
              defaultValue={s.rentReliefCapNaira}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="workingDaysPerMonth">
              Working days / month (daily rate)
            </Label>
            <Input
              id="workingDaysPerMonth"
              name="workingDaysPerMonth"
              type="number"
              min={1}
              max={31}
              defaultValue={s.workingDaysPerMonth ?? 22}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-stone-500">
              Used for unpaid leave and attendance daily-rate deductions. Not a
              hard-coded 22 for every company.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>PAYE tax bands (annual)</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={resetBandsToNta2025}>
            Reset to NTA 2025
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.taxBands.map((band, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <Input
                type="number"
                value={band.lowerBoundNaira}
                onChange={(e) => updateBand(i, "lowerBoundNaira", e.target.value)}
                placeholder="Lower ₦"
              />
              <Input
                type="number"
                value={band.upperBoundNaira ?? ""}
                onChange={(e) => updateBand(i, "upperBoundNaira", e.target.value)}
                placeholder="Upper ₦ (empty = no limit)"
              />
              <Input
                type="number"
                step="0.01"
                value={band.ratePercent}
                onChange={(e) => updateBand(i, "ratePercent", e.target.value)}
                placeholder="Rate %"
              />
            </div>
          ))}
          <p className="text-xs text-stone-400">
            Bands apply to annual taxable income. Verify against current FIRS guidance
            before changing.
          </p>
        </CardContent>
      </Card>

      {message && (
        <p className={`text-sm ${message.includes("saved") ? "text-emerald-700" : "text-red-600"}`}>
          {message}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
