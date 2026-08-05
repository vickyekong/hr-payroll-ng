"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, getMonthName } from "@/lib/utils";

interface ForecastResult {
  scenario: {
    label: string;
    headcount: number;
    perHire: {
      grossKobo: string;
      netKobo: string;
      employerCostKobo: string;
    };
    monthly: {
      grossKobo: string;
      netKobo: string;
      employerCostKobo: string;
      payeKobo: string;
      pensionEmployerKobo: string;
      nsitfKobo: string;
    };
    annualEmployerCostKobo: string;
  };
  baseline: {
    headcount: number;
    monthlyGrossKobo: string;
    monthlyNetKobo: string;
    monthlyEmployerCostKobo: string;
    period: { month: number; year: number };
  } | null;
  projected: {
    projectedHeadcount: number;
    projectedGrossKobo: string;
    projectedNetKobo: string;
    projectedEmployerCostKobo: string;
    deltaEmployerCostKobo: string;
  };
}

export function PayrollForecastSection() {
  const [headcount, setHeadcount] = useState(5);
  const [basicNaira, setBasicNaira] = useState(350000);
  const [housingNaira, setHousingNaira] = useState(100000);
  const [transportNaira, setTransportNaira] = useState(50000);
  const [label, setLabel] = useState("Senior Engineer");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runForecast(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/reports/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headcount,
        basicNaira,
        housingNaira,
        transportNaira,
        label,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Forecast failed");
      return;
    }
    setResult(data);
  }

  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Headcount &amp; payroll forecast
        </h2>
        <p className="text-sm text-stone-500">
          Model the monthly run-rate impact of new hires using your current
          statutory rates (PAYE, pension, NHF, NSITF).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={runForecast}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <Label htmlFor="fc-label">Role label</Label>
              <Input
                id="fc-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fc-count">Headcount to add</Label>
              <Input
                id="fc-count"
                type="number"
                min={1}
                max={500}
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="fc-basic">Monthly basic (₦)</Label>
              <Input
                id="fc-basic"
                type="number"
                min={1}
                step={1000}
                value={basicNaira}
                onChange={(e) => setBasicNaira(Number(e.target.value))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="fc-housing">Housing (₦)</Label>
              <Input
                id="fc-housing"
                type="number"
                min={0}
                step={1000}
                value={housingNaira}
                onChange={(e) => setHousingNaira(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="fc-transport">Transport (₦)</Label>
              <Input
                id="fc-transport"
                type="number"
                min={0}
                step={1000}
                value={transportNaira}
                onChange={(e) => setTransportNaira(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Calculating…" : "Run scenario"}
              </Button>
            </div>
          </form>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Per hire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Gross</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(BigInt(result.scenario.perHire.grossKobo))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Net</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(BigInt(result.scenario.perHire.netKobo))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Employer cost</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(
                    BigInt(result.scenario.perHire.employerCostKobo)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                +{result.scenario.headcount} {result.scenario.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Monthly employer Δ</span>
                <span className="tabular-nums font-semibold text-stone-900">
                  {formatCurrency(
                    BigInt(result.projected.deltaEmployerCostKobo)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Annual employer Δ</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(
                    BigInt(result.scenario.annualEmployerCostKobo)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">PAYE / mo</span>
                <span className="tabular-nums">
                  {formatCurrency(BigInt(result.scenario.monthly.payeKobo))}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Projected payroll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {result.baseline && (
                <p className="text-xs text-stone-500">
                  Baseline: {result.baseline.headcount} staff ·{" "}
                  {getMonthName(result.baseline.period.month)}{" "}
                  {result.baseline.period.year}
                </p>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Headcount</span>
                <span className="tabular-nums font-medium">
                  {result.projected.projectedHeadcount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Monthly gross</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(
                    BigInt(result.projected.projectedGrossKobo)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Monthly employer cost</span>
                <span className="tabular-nums font-semibold">
                  {formatCurrency(
                    BigInt(result.projected.projectedEmployerCostKobo)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
