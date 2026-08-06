"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCurrency,
} from "@/components/ui/table";
import { employeeFullName } from "@/lib/utils";
import {
  EMPLOYEE_SEX_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS,
  type EmployeeSexValue,
  type EmployeeStatusValue,
} from "@/lib/employees/status";

export interface EmployeeTableRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  status: EmployeeStatusValue | string;
  sex: EmployeeSexValue | string | null;
  basicSalaryKobo: string | number | bigint;
  housingAllowanceKobo: string | number | bigint;
  transportAllowanceKobo: string | number | bigint;
  otherTaxableAllowancesKobo: string | number | bigint;
}

function toBigInt(value: string | number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

export function EmployeesTable({
  employees,
  departments,
  jobDescriptions,
}: {
  employees: EmployeeTableRow[];
  departments: string[];
  jobDescriptions: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(employees);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setRows(employees);
  }, [employees]);

  async function patchEmployee(
    id: string,
    patch: {
      status?: string;
      sex?: string | null;
      department?: string;
      jobTitle?: string;
    }
  ) {
    setSavingId(id);
    const previous = rows.find((r) => r.id === id);
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update employee");
      }
      router.refresh();
    } catch (err) {
      if (previous) {
        setRows((current) =>
          current.map((row) => (row.id === id ? previous : row))
        );
      }
      alert(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setSavingId(null);
    }
  }

  const departmentOptions = Array.from(
    new Set([
      ...departments,
      ...rows.map((r) => r.department).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const jobDescriptionOptions = Array.from(
    new Set([
      ...jobDescriptions,
      ...rows.map((r) => r.jobTitle).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Sex</TableHead>
            <TableHead>Job description</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Gross (monthly)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((emp) => {
            const gross =
              toBigInt(emp.basicSalaryKobo) +
              toBigInt(emp.housingAllowanceKobo) +
              toBigInt(emp.transportAllowanceKobo) +
              toBigInt(emp.otherTaxableAllowancesKobo);

            return (
              <TableRow key={emp.id}>
                <TableCell>
                  <Link
                    href={`/employees/${emp.id}`}
                    className="font-medium text-stone-900 hover:underline"
                  >
                    {emp.employeeCode}
                  </Link>
                </TableCell>
                <TableCell>
                  {employeeFullName(emp.firstName, emp.lastName)}
                </TableCell>
                <TableCell>
                  <select
                    aria-label={`Sex for ${emp.employeeCode}`}
                    className="h-8 min-w-[7.5rem] rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-800 disabled:opacity-60"
                    value={emp.sex ?? ""}
                    disabled={savingId === emp.id}
                    onChange={(e) => {
                      const value = e.target.value;
                      void patchEmployee(emp.id, {
                        sex: value === "" ? null : value,
                      });
                    }}
                  >
                    <option value="">Select…</option>
                    {EMPLOYEE_SEX_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    aria-label={`Job description for ${emp.employeeCode}`}
                    className="h-8 min-w-[11rem] rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-800 disabled:opacity-60"
                    value={emp.jobTitle}
                    disabled={
                      savingId === emp.id || jobDescriptionOptions.length === 0
                    }
                    onChange={(e) => {
                      void patchEmployee(emp.id, {
                        jobTitle: e.target.value,
                      });
                    }}
                  >
                    {jobDescriptionOptions.length === 0 && (
                      <option value={emp.jobTitle || ""}>
                        Add job descriptions above
                      </option>
                    )}
                    {jobDescriptionOptions.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    aria-label={`Department for ${emp.employeeCode}`}
                    className="h-8 min-w-[10rem] rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-800 disabled:opacity-60"
                    value={emp.department}
                    disabled={savingId === emp.id}
                    onChange={(e) => {
                      void patchEmployee(emp.id, {
                        department: e.target.value,
                      });
                    }}
                  >
                    <option value="">Select…</option>
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    aria-label={`Status for ${emp.employeeCode}`}
                    className="h-8 min-w-[9rem] rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-800 disabled:opacity-60"
                    value={emp.status}
                    disabled={savingId === emp.id}
                    onChange={(e) => {
                      void patchEmployee(emp.id, { status: e.target.value });
                    }}
                  >
                    {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="text-right">
                  <TableCurrency value={gross} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
