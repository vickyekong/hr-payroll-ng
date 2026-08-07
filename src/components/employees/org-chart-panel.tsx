"use client";

import { useMemo } from "react";
import type { EmployeeTableRow } from "@/components/employees/employees-table";

type OrgPerson = Pick<
  EmployeeTableRow,
  "id" | "employeeCode" | "firstName" | "lastName" | "jobTitle" | "department" | "status"
>;

export function OrgChartPanel({ employees }: { employees: OrgPerson[] }) {
  const departments = useMemo(() => {
    const active = employees.filter(
      (e) =>
        e.status === "ACTIVE" ||
        e.status === "ON_LEAVE" ||
        e.status === "SICK_LEAVE"
    );
    const byDept = new Map<string, OrgPerson[]>();
    for (const emp of active) {
      const key = emp.department?.trim() || "Unassigned";
      const list = byDept.get(key) ?? [];
      list.push(emp);
      byDept.set(key, list);
    }
    return Array.from(byDept.entries())
      .map(([name, people]) => ({
        name,
        people: [...people].sort((a, b) => {
          const title = a.jobTitle.localeCompare(b.jobTitle);
          if (title !== 0) return title;
          return `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`
          );
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const total = departments.reduce((n, d) => n + d.people.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Organisation chart</h2>
        <p className="mt-1 text-sm text-stone-500">
          Active staff grouped by department and job description ({total} people
          · {departments.length} departments)
        </p>
      </div>

      {departments.length === 0 ? (
        <p className="text-sm text-stone-500">No active staff to show.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((dept) => (
            <section
              key={dept.name}
              className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <header className="mb-3 border-b border-stone-100 pb-2">
                <h3 className="text-sm font-semibold text-stone-900">
                  {dept.name}
                </h3>
                <p className="text-xs text-stone-500">
                  {dept.people.length}{" "}
                  {dept.people.length === 1 ? "person" : "people"}
                </p>
              </header>
              <ul className="space-y-2">
                {dept.people.map((person) => (
                  <li key={person.id} className="text-sm">
                    <a
                      href={`/employees/${person.id}`}
                      className="font-medium text-stone-900 hover:underline"
                    >
                      {person.firstName} {person.lastName}
                    </a>
                    <p className="text-xs text-stone-500">
                      {person.jobTitle || "—"}
                      <span className="text-stone-400">
                        {" "}
                        · {person.employeeCode}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
