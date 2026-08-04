"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DepartmentsManager } from "@/components/employees/departments-manager";
import {
  EmployeesTable,
  type EmployeeTableRow,
} from "@/components/employees/employees-table";
import { EmployeesAttendanceTab } from "@/components/employees/employees-attendance-tab";
import { cn } from "@/lib/cn";

interface Department {
  id: string;
  name: string;
}

type TabId = "staff" | "attendance";

export function EmployeesPageClient({
  employees,
  initialDepartments,
}: {
  employees: EmployeeTableRow[];
  initialDepartments: Department[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "attendance" ? "attendance" : "staff";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [departments, setDepartments] = useState(initialDepartments);

  useEffect(() => {
    setTab(searchParams.get("tab") === "attendance" ? "attendance" : "staff");
  }, [searchParams]);

  function selectTab(next: TabId) {
    setTab(next);
    const url =
      next === "attendance" ? "/employees?tab=attendance" : "/employees";
    router.replace(url, { scroll: false });
  }

  return (
    <>
      <div className="mb-6 flex gap-1 border-b border-stone-200">
        <button
          type="button"
          onClick={() => selectTab("staff")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "staff"
              ? "border-stone-900 text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-800"
          )}
        >
          Staff directory
        </button>
        <button
          type="button"
          onClick={() => selectTab("attendance")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "attendance"
              ? "border-stone-900 text-stone-900"
              : "border-transparent text-stone-500 hover:text-stone-800"
          )}
        >
          Clock machine & attendance
        </button>
      </div>

      {tab === "staff" ? (
        <>
          <DepartmentsManager
            initialDepartments={initialDepartments}
            onChange={setDepartments}
          />
          <EmployeesTable
            employees={employees}
            departments={departments.map((d) => d.name)}
          />
        </>
      ) : (
        <EmployeesAttendanceTab />
      )}
    </>
  );
}
