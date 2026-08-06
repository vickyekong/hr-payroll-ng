"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  OrgCatalogManager,
  type CatalogItem,
} from "@/components/employees/org-catalog-manager";
import {
  EmployeesTable,
  type EmployeeTableRow,
} from "@/components/employees/employees-table";
import { EmployeesAttendanceTab } from "@/components/employees/employees-attendance-tab";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type TabId = "staff" | "jobs" | "departments" | "attendance";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "staff", label: "Staff directory" },
  { id: "jobs", label: "Job descriptions" },
  { id: "departments", label: "Departments" },
  { id: "attendance", label: "Clock machine & attendance" },
];

function tabFromSearch(value: string | null): TabId {
  if (value === "attendance") return "attendance";
  if (value === "jobs" || value === "job-descriptions") return "jobs";
  if (value === "departments") return "departments";
  return "staff";
}

function hrefForTab(tab: TabId): string {
  if (tab === "staff") return "/employees";
  if (tab === "jobs") return "/employees?tab=jobs";
  if (tab === "departments") return "/employees?tab=departments";
  return "/employees?tab=attendance";
}

export function EmployeesPageClient({
  employees,
  initialDepartments,
  initialJobDescriptions,
}: {
  employees: EmployeeTableRow[];
  initialDepartments: CatalogItem[];
  initialJobDescriptions: CatalogItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(() =>
    tabFromSearch(searchParams.get("tab"))
  );
  const [departments, setDepartments] = useState(initialDepartments);
  const [jobDescriptions, setJobDescriptions] = useState(
    initialJobDescriptions
  );

  useEffect(() => {
    setTab(tabFromSearch(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  useEffect(() => {
    setJobDescriptions(initialJobDescriptions);
  }, [initialJobDescriptions]);

  function selectTab(next: TabId) {
    setTab(next);
    router.replace(hrefForTab(next), { scroll: false });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <EmployeesTable
          employees={employees}
          departments={departments.map((d) => d.name)}
          jobDescriptions={jobDescriptions.map((d) => d.name)}
        />
      )}

      {tab === "jobs" && (
        <Card>
          <CardContent className="pt-6">
            <OrgCatalogManager
              title="Job descriptions"
              description="Add job descriptions here, then assign them to employees from the Staff directory table. You can edit or remove existing ones."
              itemLabel="job description"
              items={jobDescriptions}
              apiBase="/api/job-descriptions"
              onChange={(next) => {
                setJobDescriptions(next);
                router.refresh();
              }}
            />
          </CardContent>
        </Card>
      )}

      {tab === "departments" && (
        <Card>
          <CardContent className="pt-6">
            <OrgCatalogManager
              title="Departments"
              description="Company departments (Admin, Finance, Floor Staffs, and more). Edit names or add new ones, then assign them on each employee row in Staff directory."
              itemLabel="department"
              items={departments}
              apiBase="/api/departments"
              onChange={(next) => {
                setDepartments(next);
                router.refresh();
              }}
            />
          </CardContent>
        </Card>
      )}

      {tab === "attendance" && <EmployeesAttendanceTab />}
    </>
  );
}
