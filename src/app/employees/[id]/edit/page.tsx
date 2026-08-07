"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { koboToNaira } from "@/lib/money";
import { isShiftAttendanceExempt } from "@/lib/attendance/penalty-exempt";
import { EMPLOYEE_STATUS_OPTIONS } from "@/lib/employees/status";
import { can } from "@/lib/permissions";

interface EmployeeData {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  status: string;
  sex: string | null;
  employmentType: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  tin: string | null;
  rsaPin: string | null;
  nhfNumber: string | null;
  basicSalaryKobo: string;
  housingAllowanceKobo: string;
  transportAllowanceKobo: string;
  otherTaxableAllowancesKobo: string;
  nonTaxableReimbursementsKobo: string;
  annualRentKobo: string;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  clockDeviceId: string | null;
  shiftAssignment?: { shiftId: string } | null;
}

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const canEditPay = session?.user?.role
    ? can(session.user.role, "manageCompensation")
    : false;
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [jobDescriptions, setJobDescriptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [shifts, setShifts] = useState<Array<{ id: string; name: string }>>([]);
  const [department, setDepartment] = useState("");

  useEffect(() => {
    fetch(`/api/employees/${params.id}`)
      .then((r) => r.json())
      .then((data: EmployeeData) => {
        setEmployee(data);
        setDepartment(data.department ?? "");
      });
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => setDepartments(Array.isArray(data) ? data : []));
    fetch("/api/job-descriptions")
      .then((r) => r.json())
      .then((data) => setJobDescriptions(Array.isArray(data) ? data : []))
      .catch(() => setJobDescriptions([]));
    fetch("/api/attendance/shifts")
      .then((r) => r.json())
      .then((data) =>
        setShifts(
          (Array.isArray(data) ? data : []).map(
            (s: { id: string; name: string }) => ({ id: s.id, name: s.name })
          )
        )
      )
      .catch(() => setShifts([]));
  }, [params.id]);

  const shiftExempt = isShiftAttendanceExempt(department);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      department: form.get("department"),
      jobTitle: form.get("jobTitle"),
      status: form.get("status"),
      sex: form.get("sex") || null,
      employmentType: form.get("employmentType"),
      clockDeviceId: String(form.get("clockDeviceId") || "").trim() || null,
      shiftId: shiftExempt
        ? null
        : String(form.get("shiftId") || "") || null,
      bankName: form.get("bankName") || undefined,
      bankAccountNumber: form.get("bankAccountNumber") || undefined,
      tin: form.get("tin") || undefined,
      rsaPin: form.get("rsaPin") || undefined,
      nhfNumber: form.get("nhfNumber") || undefined,
      nextOfKinName: form.get("nextOfKinName") || undefined,
      nextOfKinPhone: form.get("nextOfKinPhone") || undefined,
    };

    if (canEditPay) {
      payload.basicSalary = Number(form.get("basicSalary"));
      payload.housingAllowance = Number(form.get("housingAllowance") || 0);
      payload.transportAllowance = Number(form.get("transportAllowance") || 0);
      payload.otherTaxableAllowances = Number(
        form.get("otherTaxableAllowances") || 0
      );
      payload.nonTaxableReimbursements = Number(
        form.get("nonTaxableReimbursements") || 0
      );
      payload.annualRent = Number(form.get("annualRent") || 0);
    }

    const res = await fetch(`/api/employees/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to update employee");
      return;
    }
    router.push(`/employees/${params.id}`);
    router.refresh();
  }

  if (!employee) {
    return (
      <AppShell>
        <p className="text-stone-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm text-stone-500">{employee.employeeCode}</p>
        <h1 className="text-2xl font-semibold text-stone-900">Edit Employee</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Employee details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={employee.firstName}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={employee.lastName}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="jobTitle">Job description</Label>
                <select
                  id="jobTitle"
                  name="jobTitle"
                  defaultValue={employee.jobTitle}
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  {[
                    ...new Set([
                      employee.jobTitle,
                      ...jobDescriptions.map((d) => d.name),
                    ]),
                  ]
                    .filter(Boolean)
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  name="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  <option value="">Select…</option>
                  {[
                    ...new Set([
                      employee.department,
                      ...departments.map((d) => d.name),
                    ]),
                  ]
                    .filter(Boolean)
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={employee.status}
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="clockDeviceId">Clock machine ID</Label>
                <Input
                  id="clockDeviceId"
                  name="clockDeviceId"
                  defaultValue={employee.clockDeviceId ?? ""}
                  placeholder="Badge / AcNo from device"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="shiftId">Shift</Label>
                {shiftExempt ? (
                  <p className="mt-2 text-sm text-stone-500">
                    Management is not shift-regulated — no clock-in schedule or
                    attendance penalties apply.
                  </p>
                ) : (
                  <select
                    id="shiftId"
                    name="shiftId"
                    defaultValue={employee.shiftAssignment?.shiftId ?? ""}
                    className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                  >
                    <option value="">No shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <Label htmlFor="sex">Sex</Label>
                <select
                  id="sex"
                  name="sex"
                  defaultValue={employee.sex ?? ""}
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  <option value="">Select…</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div>
                <Label htmlFor="employmentType">Employment type</Label>
                <select
                  id="employmentType"
                  name="employmentType"
                  defaultValue={employee.employmentType}
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  <option value="FULL_TIME">Full-time</option>
                  <option value="CONTRACT">Contract</option>
                </select>
              </div>
            </div>

            {canEditPay ? (
            <div className="border-t border-stone-100 pt-4">
              <p className="mb-3 text-sm font-medium text-stone-700">
                Compensation (₦)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="basicSalary">Basic</Label>
                  <Input
                    id="basicSalary"
                    name="basicSalary"
                    type="number"
                    step="0.01"
                    defaultValue={koboToNaira(BigInt(employee.basicSalaryKobo))}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="housingAllowance">Housing</Label>
                  <Input
                    id="housingAllowance"
                    name="housingAllowance"
                    type="number"
                    step="0.01"
                    defaultValue={koboToNaira(BigInt(employee.housingAllowanceKobo))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="transportAllowance">Transport</Label>
                  <Input
                    id="transportAllowance"
                    name="transportAllowance"
                    type="number"
                    step="0.01"
                    defaultValue={koboToNaira(BigInt(employee.transportAllowanceKobo))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="otherTaxableAllowances">Other taxable</Label>
                  <Input
                    id="otherTaxableAllowances"
                    name="otherTaxableAllowances"
                    type="number"
                    step="0.01"
                    defaultValue={koboToNaira(
                      BigInt(employee.otherTaxableAllowancesKobo)
                    )}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="annualRent">Annual rent (for relief)</Label>
                  <Input
                    id="annualRent"
                    name="annualRent"
                    type="number"
                    step="0.01"
                    defaultValue={koboToNaira(BigInt(employee.annualRentKobo))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="nonTaxableReimbursements">
                    Non-taxable reimbursements
                  </Label>
                  <Input
                    id="nonTaxableReimbursements"
                    name="nonTaxableReimbursements"
                    type="number"
                    step="0.01"
                    defaultValue={koboToNaira(
                      BigInt(employee.nonTaxableReimbursementsKobo)
                    )}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            ) : (
            <div className="border-t border-stone-100 pt-4">
              <p className="text-sm text-stone-500">
                Compensation is view-only for your role. Ask a Super Admin or HR
                user with pay access to change salary fields.
              </p>
            </div>
            )}

            <div className="border-t border-stone-100 pt-4">
              <p className="mb-3 text-sm font-medium text-stone-700">Bank & statutory</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input
                    id="bankName"
                    name="bankName"
                    defaultValue={employee.bankName ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bankAccountNumber">Account number</Label>
                  <Input
                    id="bankAccountNumber"
                    name="bankAccountNumber"
                    defaultValue={employee.bankAccountNumber ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tin">TIN</Label>
                  <Input id="tin" name="tin" defaultValue={employee.tin ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="rsaPin">RSA PIN</Label>
                  <Input
                    id="rsaPin"
                    name="rsaPin"
                    defaultValue={employee.rsaPin ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="nhfNumber">NHF number</Label>
                  <Input
                    id="nhfNumber"
                    name="nhfNumber"
                    defaultValue={employee.nhfNumber ?? ""}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4">
              <p className="mb-3 text-sm font-medium text-stone-700">Next of kin</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nextOfKinName">Name</Label>
                  <Input
                    id="nextOfKinName"
                    name="nextOfKinName"
                    defaultValue={employee.nextOfKinName ?? ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="nextOfKinPhone">Phone</Label>
                  <Input
                    id="nextOfKinPhone"
                    name="nextOfKinPhone"
                    defaultValue={employee.nextOfKinPhone ?? ""}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/employees/${params.id}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
