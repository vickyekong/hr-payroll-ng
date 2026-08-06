"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CatalogItem {
  id: string;
  name: string;
}

export function OrgCatalogManager({
  title,
  description,
  itemLabel,
  items,
  apiBase,
  onChange,
}: {
  title: string;
  description: string;
  itemLabel: string;
  items: CatalogItem[];
  apiBase: "/api/departments" | "/api/job-descriptions";
  onChange?: (items: CatalogItem[]) => void;
}) {
  const [rows, setRows] = useState(items);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function publish(next: CatalogItem[]) {
    setRows(next);
    onChange?.(next);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to add ${itemLabel}`);
      publish([...rows, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to add ${itemLabel}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to update ${itemLabel}`);
      publish(
        rows
          .map((r) => (r.id === id ? data : r))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setEditName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to update ${itemLabel}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(id: string) {
    if (!confirm(`Delete this ${itemLabel}?`)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Failed to delete ${itemLabel}`);
      publish(rows.filter((r) => r.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to delete ${itemLabel}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title ? (
            <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          ) : null}
          {description ? (
            <p className={`text-sm text-stone-500 ${title ? "mt-1" : ""}`}>
              {description}
            </p>
          ) : null}
        </div>
      )}

      <form onSubmit={addItem} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <Label htmlFor={`new-${apiBase}`}>New {itemLabel}</Label>
          <Input
            id={`new-${apiBase}`}
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${itemLabel === "department" ? "CRM" : "Bartender"}`}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Saving…" : `Add ${itemLabel}`}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">
          No {itemLabel}s yet. Add one to enable the employee dropdown.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              {editingId === row.id ? (
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 max-w-sm"
                    disabled={loading}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading || !editName.trim()}
                    onClick={() => void saveEdit(row.id)}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-stone-800">{row.name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => {
                        setEditingId(row.id);
                        setEditName(row.name);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => void removeItem(row.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
