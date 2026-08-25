import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { buildStaffExportCsv } from "@/lib/exports/staff";
import { buildPayrollExportCsv } from "@/lib/exports/payroll";
import { buildCsv, formatNairaFromKobo } from "@/lib/reports/csv";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";

const SCOPES = [
  "openid",
  "offline_access",
  "User.Read",
  "Files.ReadWrite",
].join(" ");

type GraphTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type DriveItem = {
  id: string;
  name?: string;
  webUrl?: string;
  folder?: Record<string, unknown>;
  file?: Record<string, unknown>;
};

function getTenant(): string {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "common";
}

export function isMicrosoftWorkspaceConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}

export function getMicrosoftRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXTAUTH_URL is required for Microsoft Workspace OAuth");
  }
  return `${base}/api/integrations/microsoft-workspace/callback`;
}

export function getMicrosoftAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Microsoft Workspace is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getMicrosoftRedirectUri(),
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "consent",
  });

  return `https://login.microsoftonline.com/${getTenant()}/oauth2/v2.0/authorize?${params}`;
}

async function exchangeToken(body: Record<string, string>) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Microsoft Workspace is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
    );
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${getTenant()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...body,
      }),
    }
  );

  const data = (await res.json()) as GraphTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Microsoft token exchange failed"
    );
  }
  return data;
}

export async function exchangeMicrosoftCode(code: string) {
  const data = await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: getMicrosoftRedirectUri(),
    scope: SCOPES,
  });

  if (!data.refresh_token) {
    throw new Error(
      "No refresh token returned. Ensure offline_access is granted and try reconnecting."
    );
  }

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const me = (await meRes.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };

  return {
    refreshToken: encryptSecret(data.refresh_token),
    email: me.mail || me.userPrincipalName || null,
  };
}

async function getAccessToken(companyId: string) {
  const integration = await prisma.microsoftWorkspaceIntegration.findUnique({
    where: { companyId },
  });
  if (!integration) {
    throw new Error(
      "Microsoft Workspace is not connected. Connect it in Settings."
    );
  }

  const data = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: decryptSecret(integration.refreshToken),
    scope: SCOPES,
  });

  // Microsoft may rotate refresh tokens
  if (data.refresh_token) {
    await prisma.microsoftWorkspaceIntegration.update({
      where: { companyId },
      data: { refreshToken: encryptSecret(data.refresh_token) },
    });
  }

  return { accessToken: data.access_token, integration };
}

async function graphFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ||
      `Microsoft Graph request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

function csvToRows(csv: string): string[][] {
  return csv.split("\n").map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  });
}

function rowsToXlsxBuffer(rows: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

async function listChildren(
  accessToken: string,
  parentId: string | "root"
): Promise<DriveItem[]> {
  const path =
    parentId === "root"
      ? `/me/drive/root/children?$top=200`
      : `/me/drive/items/${parentId}/children?$top=200`;
  const data = await graphFetch<{ value: DriveItem[] }>(accessToken, path);
  return data.value ?? [];
}

async function ensureFolder(
  accessToken: string,
  name: string,
  parentId?: string | null
): Promise<string> {
  const children = await listChildren(
    accessToken,
    parentId ? parentId : "root"
  );
  const existing = children.find(
    (item) => item.folder && item.name?.toLowerCase() === name.toLowerCase()
  );
  if (existing?.id) return existing.id;

  const createPath = parentId
    ? `/me/drive/items/${parentId}/children`
    : `/me/drive/root/children`;

  const created = await graphFetch<DriveItem>(accessToken, createPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });
  return created.id;
}

export async function ensureMicrosoftWorkspaceFolders(companyId: string) {
  const { accessToken, integration } = await getAccessToken(companyId);

  const rootId =
    integration.folderId ||
    process.env.MICROSOFT_DRIVE_FOLDER_ID ||
    (await ensureFolder(accessToken, "OmniPeople"));

  if (!integration.folderId && !process.env.MICROSOFT_DRIVE_FOLDER_ID) {
    await prisma.microsoftWorkspaceIntegration.update({
      where: { companyId },
      data: { folderId: rootId },
    });
  }

  const staffFolderId = await ensureFolder(accessToken, "Staff", rootId);
  const payrollFolderId = await ensureFolder(accessToken, "Payroll", rootId);
  const exportsFolderId = await ensureFolder(accessToken, "Exports", rootId);

  return {
    accessToken,
    rootId,
    staffFolderId,
    payrollFolderId,
    exportsFolderId,
  };
}

async function upsertWorkbook(options: {
  accessToken: string;
  folderId: string;
  filename: string;
  existingId?: string | null;
  rows: string[][];
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const buffer = rowsToXlsxBuffer(options.rows);

  if (options.existingId) {
    try {
      const updated = await graphFetch<DriveItem>(
        options.accessToken,
        `/me/drive/items/${options.existingId}/content`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
          body: new Uint8Array(buffer),
        }
      );
      return {
        fileId: updated.id || options.existingId,
        webViewLink: updated.webUrl ?? null,
      };
    } catch {
      // Fall through and recreate if the prior file was deleted.
    }
  }

  const encodedName = encodeURIComponent(options.filename);
  const created = await graphFetch<DriveItem>(
    options.accessToken,
    `/me/drive/items/${options.folderId}:/${encodedName}:/content`,
    {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: new Uint8Array(buffer),
    }
  );

  return {
    fileId: created.id,
    webViewLink: created.webUrl ?? null,
  };
}

export async function uploadCsvToMicrosoftOneDrive(options: {
  companyId: string;
  filename: string;
  csv: string;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const { accessToken, exportsFolderId } =
    await ensureMicrosoftWorkspaceFolders(options.companyId);

  const encodedName = encodeURIComponent(options.filename);
  const created = await graphFetch<DriveItem>(
    accessToken,
    `/me/drive/items/${exportsFolderId}:/${encodedName}:/content`,
    {
      method: "PUT",
      headers: { "Content-Type": "text/csv" },
      body: options.csv,
    }
  );

  return {
    fileId: created.id,
    webViewLink: created.webUrl ?? null,
  };
}

export async function syncStaffToMicrosoftWorkspace(companyId: string) {
  const { accessToken, staffFolderId, rootId } =
    await ensureMicrosoftWorkspaceFolders(companyId);
  const integration = await prisma.microsoftWorkspaceIntegration.findUniqueOrThrow({
    where: { companyId },
  });

  const { csv, rowCount } = await buildStaffExportCsv(companyId);
  const result = await upsertWorkbook({
    accessToken,
    folderId: staffFolderId,
    filename: "OmniPeople — Staff Database.xlsx",
    existingId: integration.staffSpreadsheetId,
    rows: csvToRows(csv),
  });

  await prisma.microsoftWorkspaceIntegration.update({
    where: { companyId },
    data: {
      folderId: rootId,
      staffSpreadsheetId: result.fileId,
      lastStaffSyncAt: new Date(),
    },
  });

  return {
    type: "staff" as const,
    rowCount,
    spreadsheetId: result.fileId,
    webViewLink: result.webViewLink,
  };
}

export async function syncPayrollToMicrosoftWorkspace(
  companyId: string,
  runId?: string
) {
  const { accessToken, payrollFolderId, rootId } =
    await ensureMicrosoftWorkspaceFolders(companyId);
  const integration = await prisma.microsoftWorkspaceIntegration.findUniqueOrThrow({
    where: { companyId },
  });

  let rows: string[][];
  let rowCount = 0;
  let filename = "OmniPeople — Payroll Database.xlsx";

  if (runId) {
    const exportData = await buildPayrollExportCsv(companyId, runId);
    rows = csvToRows(exportData.csv);
    rowCount = exportData.rowCount;
    filename = `OmniPeople — Payroll ${exportData.periodLabel}.xlsx`;
  } else {
    const runs = await prisma.payrollRun.findMany({
      where: { companyId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                employeeCode: true,
                firstName: true,
                lastName: true,
                department: true,
              },
            },
          },
        },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });

    const headers = [
      "Period Month",
      "Period Year",
      "Status",
      "Employee Code",
      "First Name",
      "Last Name",
      "Department",
      "Gross (NGN)",
      "PAYE (NGN)",
      "Pension Employee (NGN)",
      "NHF (NGN)",
      "Net Pay (NGN)",
    ];

    const dataRows = runs.flatMap((run) =>
      run.payslips.map((p) => [
        String(run.periodMonth),
        String(run.periodYear),
        run.status,
        p.employee.employeeCode,
        p.employee.firstName,
        p.employee.lastName,
        p.employee.department,
        formatNairaFromKobo(p.grossPayKobo),
        formatNairaFromKobo(p.payeKobo),
        formatNairaFromKobo(p.pensionEmployeeKobo),
        formatNairaFromKobo(p.nhfKobo),
        formatNairaFromKobo(p.netPayKobo),
      ])
    );

    rows = csvToRows(buildCsv(headers, dataRows));
    rowCount = dataRows.length;
  }

  const result = await upsertWorkbook({
    accessToken,
    folderId: payrollFolderId,
    filename,
    existingId: runId ? null : integration.payrollSpreadsheetId,
    rows,
  });

  if (!runId) {
    await prisma.microsoftWorkspaceIntegration.update({
      where: { companyId },
      data: {
        folderId: rootId,
        payrollSpreadsheetId: result.fileId,
        lastPayrollSyncAt: new Date(),
      },
    });
  }

  return {
    type: "payroll" as const,
    rowCount,
    spreadsheetId: result.fileId,
    webViewLink: result.webViewLink,
  };
}

export async function getMicrosoftWorkspaceStatus(companyId: string) {
  const configured = isMicrosoftWorkspaceConfigured();
  const integration = await prisma.microsoftWorkspaceIntegration.findUnique({
    where: { companyId },
    select: {
      email: true,
      folderId: true,
      connectedAt: true,
      staffSpreadsheetId: true,
      payrollSpreadsheetId: true,
      lastStaffSyncAt: true,
      lastPayrollSyncAt: true,
    },
  });

  return {
    configured,
    connected: Boolean(integration),
    email: integration?.email ?? null,
    folderId:
      integration?.folderId ?? process.env.MICROSOFT_DRIVE_FOLDER_ID ?? null,
    connectedAt: integration?.connectedAt ?? null,
    staffSpreadsheetId: integration?.staffSpreadsheetId ?? null,
    payrollSpreadsheetId: integration?.payrollSpreadsheetId ?? null,
    lastStaffSyncAt: integration?.lastStaffSyncAt ?? null,
    lastPayrollSyncAt: integration?.lastPayrollSyncAt ?? null,
    tenant: getTenant() === "common" ? null : getTenant(),
  };
}
