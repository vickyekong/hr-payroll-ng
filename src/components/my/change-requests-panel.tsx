"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RequestType = "BANK" | "TAX_RELIEF" | "NEXT_OF_KIN" | "ADDRESS";

interface ChangeRequest {
  id: string;
  type: string;
  status: string;
  payload: Record<string, string>;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export function MyChangeRequestsPanel() {
  const [type, setType] = useState<RequestType>("BANK");
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/change-requests?scope=mine")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const note = String(form.get("note") || "") || undefined;

    let payload: Record<string, string> = {};
    if (type === "BANK") {
      payload = {
        bankName: String(form.get("bankName") || ""),
        bankAccountNumber: String(form.get("bankAccountNumber") || ""),
      };
    } else if (type === "TAX_RELIEF") {
      payload = {
        tin: String(form.get("tin") || ""),
        annualRentNaira: String(form.get("annualRentNaira") || ""),
      };
    } else if (type === "NEXT_OF_KIN") {
      payload = {
        nextOfKinName: String(form.get("nextOfKinName") || ""),
        nextOfKinPhone: String(form.get("nextOfKinPhone") || ""),
      };
    } else {
      payload = { addressLine: String(form.get("addressLine") || "") };
    }

    const res = await fetch("/api/change-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload, note }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Submit failed");
      return;
    }
    setMessage("Submitted for HR approval");
    (e.target as HTMLFormElement).reset();
    load();
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Request a profile update</CardTitle>
          <p className="text-sm text-stone-500">
            Changes are validated then sent to HR for Approve / Reject — no
            manual data entry on their side for bank, tax, or next of kin.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="cr-type">Request type</Label>
              <select
                id="cr-type"
                value={type}
                onChange={(e) => setType(e.target.value as RequestType)}
                className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
              >
                <option value="BANK">Bank details</option>
                <option value="TAX_RELIEF">TIN / rent relief</option>
                <option value="NEXT_OF_KIN">Next of kin</option>
                <option value="ADDRESS">Residential address</option>
              </select>
            </div>

            {type === "BANK" && (
              <>
                <div>
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input id="bankName" name="bankName" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="bankAccountNumber">
                    Account number (10-digit NUBAN)
                  </Label>
                  <Input
                    id="bankAccountNumber"
                    name="bankAccountNumber"
                    required
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {type === "TAX_RELIEF" && (
              <>
                <div>
                  <Label htmlFor="tin">TIN</Label>
                  <Input id="tin" name="tin" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="annualRentNaira">Annual rent (₦)</Label>
                  <Input
                    id="annualRentNaira"
                    name="annualRentNaira"
                    type="number"
                    min={0}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {type === "NEXT_OF_KIN" && (
              <>
                <div>
                  <Label htmlFor="nextOfKinName">Name</Label>
                  <Input
                    id="nextOfKinName"
                    name="nextOfKinName"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="nextOfKinPhone">Phone</Label>
                  <Input
                    id="nextOfKinPhone"
                    name="nextOfKinPhone"
                    required
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {type === "ADDRESS" && (
              <div>
                <Label htmlFor="addressLine">Address</Label>
                <Input
                  id="addressLine"
                  name="addressLine"
                  required
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="note">Note to HR (optional)</Label>
              <Input id="note" name="note" className="mt-1" />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit for approval"}
            </Button>
            {message && (
              <p className="text-sm text-stone-600">{message}</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My requests</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-stone-500">No requests yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {items.map((r) => (
                <li key={r.id} className="py-3">
                  <p className="font-medium text-stone-900">
                    {r.type.replace(/_/g, " ")} · {r.status}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {new Date(r.createdAt).toLocaleString()}
                    {r.reviewNote ? ` · ${r.reviewNote}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
