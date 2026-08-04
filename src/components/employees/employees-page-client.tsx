"use client";

import { useState } from "react";
import { DepartmentsManager } from "@/components/employees/departments-manager";
import {
  EmployeesTable,
  type EmployeeTableRow,
} from "@/components/employees/employees-table";

interface Department {
  id: string;
  name: string;
}

export function EmployeesPageClient({
  employees,
  initialDepartments,
}: {
  employees: EmployeeTableRow[];
  initialDepartments: Department[];
}) {
  const [departments, setDepartments] = useState(initialDepartments);

  return (
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
  );
}
