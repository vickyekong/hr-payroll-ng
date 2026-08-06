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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type TabId = "staff" | "attendance";

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
  const initialTab =
    searchParams.get("tab") === "attendance" ? "attendance" : "staff";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [departments, setDepartments] = useState(initialDepartments);
  const [jobDescriptions, setJobDescriptions] = useState(
    initialJobDescriptions
  );
  const [departmentsOpen, setDepartmentsOpen] = useState(false);

  useEffect(() => {
    setTab(searchParams.get("tab") === "attendance" ? "attendance" : "staff");
  }, [searchParams]);

  useEffect(() => {
    setDepartments(initialDepartments);
  }, [initialDepartments]);

  useEffect(() => {
    setJobDescriptions(initialJobDescriptions);
  }, [initialJobDescriptions]);

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
          <Card className="mb-6">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle>Job descriptions</CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDepartmentsOpen(true)}
              >
                Departments
              </Button>
            </CardHeader>
            <CardContent>
              <OrgCatalogManager
                title=""
                description="Add job descriptions here, then assign them to employees from the table dropdown. You can edit or remove existing ones."
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

          <EmployeesTable
            employees={employees}
            departments={departments.map((d) => d.name)}
            jobDescriptions={jobDescriptions.map((d) => d.name)}
          />

          {departmentsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-label="Departments"
              onClick={() => setDepartmentsOpen(false)}
            >
              <Card
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-soft"
                onClick={(e) => e.stopPropagation()}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>Departments</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDepartmentsOpen(false)}
                  >
                    Close
                  </Button>
                </CardHeader>
                <CardContent>
                  <OrgCatalogManager
                    title=""
                    description="Company departments (Admin, Finance, Floor Staffs, and more). Edit names or add new ones, then assign on each employee row."
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
            </div>
          )}
        </>
      ) : (
        <EmployeesAttendanceTab />
      )}
    </>
  );
}
