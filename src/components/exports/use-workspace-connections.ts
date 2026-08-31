"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_WORKSPACE_CONNECTIONS,
  type WorkspaceConnections,
} from "@/components/exports/workspace-connections";

export function useWorkspaceConnections() {
  const [connections, setConnections] = useState<WorkspaceConnections>(
    EMPTY_WORKSPACE_CONNECTIONS
  );

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setConnections({
          google: Boolean(data.google?.connected),
          microsoft: Boolean(data.microsoft?.connected),
        });
      })
      .catch(() => undefined);
  }, []);

  return connections;
}
