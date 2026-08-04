"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Department {
  id: string;
  name: string;
}

export function DepartmentsManager({
  initialDepartments,
  onChange,
}: {
  initialDepartments: Department[];
  onChange?: (departments: Department[]) => void;
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function publish(next: Department[]) {
    setDepartments(next);
    onChange?.(next);
  }

  async function addDepartment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add department");
      publish(
        [...departments, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add department");
    } finally {
      setLoading(false);
    }
  }

  async function removeDepartment(id: string) {
    if (!confirm("Delete this department?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete department");
      publish(departments.filter((d) => d.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete department"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <p className="text-sm text-stone-500">
          Add departments here, then assign them to employees from the table
          dropdown.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={addDepartment}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="departmentName">New department</Label>
            <Input
              id="departmentName"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Saving…" : "Add department"}
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {departments.length === 0 ? (
          <p className="text-sm text-stone-500">
            No departments yet. Add one to enable the employee dropdown.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
            {departments.map((dept) => (
              <li
                key={dept.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="font-medium text-stone-800">{dept.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => void removeDepartment(dept.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
