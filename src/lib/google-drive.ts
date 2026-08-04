import { Readable } from "stream";
import { google, drive_v3, sheets_v4 } from "googleapis";
import { prisma } from "@/lib/db";
import { buildStaffExportCsv } from "@/lib/exports/staff";
import { buildPayrollExportCsv } from "@/lib/exports/payroll";
import { buildCsv, formatNairaFromKobo } from "@/lib/reports/csv";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleWorkspaceConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

/** @deprecated use isGoogleWorkspaceConfigured */
export const isGoogleDriveConfigured = isGoogleWorkspaceConfigured;

export function getGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Workspace is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri ?? getGoogleRedirectUri()
  );
}

export function getGoogleRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXTAUTH_URL is required for Google Workspace OAuth");
  }
  return `${base}/api/integrations/google-drive/callback`;
}

export function getGoogleAuthUrl(state: string): string {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. In Google Account → Third-party access, remove this app and reconnect."
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();

  return {
    refreshToken: tokens.refresh_token,
    email: me.data.email ?? null,
  };
}

async function getAuthorizedClient(companyId: string) {
  const integration = await prisma.googleDriveIntegration.findUnique({
    where: { companyId },
  });
  if (!integration) {
    throw new Error(
      "Google Workspace is not connected. Connect it in Settings."
    );
  }

  const client = getGoogleOAuthClient();
  client.setCredentials({ refresh_token: integration.refreshToken });
  return { client, integration };
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

async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string | null
): Promise<string> {
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(" and ");

  const existing = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return created.data.id!;
}

async function shareWithWorkspaceDomain(
  drive: drive_v3.Drive,
  fileId: string
): Promise<void> {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  if (!domain) return;

  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        type: "domain",
        role: process.env.GOOGLE_WORKSPACE_SHARE_ROLE === "writer" ? "writer" : "reader",
        domain,
        allowFileDiscovery: true,
      },
    });
  } catch (error) {
    // Domain sharing may fail if the account is personal Gmail; ignore.
    console.warn("Workspace domain sharing skipped:", error);
  }
}

async function upsertSpreadsheet(options: {
  drive: drive_v3.Drive;
  sheets: sheets_v4.Sheets;
  title: string;
  folderId: string;
  existingId?: string | null;
  rows: string[][];
}): Promise<{ spreadsheetId: string; webViewLink: string | null }> {
  let spreadsheetId = options.existingId ?? null;

  if (spreadsheetId) {
    try {
      await options.sheets.spreadsheets.get({ spreadsheetId });
    } catch {
      spreadsheetId = null;
    }
  }

  if (!spreadsheetId) {
    const created = await options.sheets.spreadsheets.create({
      requestBody: {
        properties: { title: options.title },
      },
      fields: "spreadsheetId",
    });
    spreadsheetId = created.data.spreadsheetId!;

    await options.drive.files.update({
      fileId: spreadsheetId,
      addParents: options.folderId,
      fields: "id, parents",
      supportsAllDrives: true,
    });

    await shareWithWorkspaceDomain(options.drive, spreadsheetId);
  }

  await options.sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "Sheet1",
  });

  await options.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "RAW",
    requestBody: { values: options.rows },
  });

  const meta = await options.drive.files.get({
    fileId: spreadsheetId,
    fields: "webViewLink",
    supportsAllDrives: true,
  });

  return {
    spreadsheetId,
    webViewLink: meta.data.webViewLink ?? null,
  };
}

export async function ensureWorkspaceFolders(companyId: string) {
  const { client, integration } = await getAuthorizedClient(companyId);
  const drive = google.drive({ version: "v3", auth: client });

  const rootId =
    integration.folderId ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    (await ensureFolder(drive, "HR Pay NG"));

  if (!integration.folderId && !process.env.GOOGLE_DRIVE_FOLDER_ID) {
    await shareWithWorkspaceDomain(drive, rootId);
    await prisma.googleDriveIntegration.update({
      where: { companyId },
      data: { folderId: rootId },
    });
  }

  const staffFolderId = await ensureFolder(drive, "Staff", rootId);
  const payrollFolderId = await ensureFolder(drive, "Payroll", rootId);
  const exportsFolderId = await ensureFolder(drive, "Exports", rootId);

  return { rootId, staffFolderId, payrollFolderId, exportsFolderId, drive, client };
}

export async function uploadCsvToGoogleDrive(options: {
  companyId: string;
  filename: string;
  csv: string;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const { exportsFolderId, drive } = await ensureWorkspaceFolders(
    options.companyId
  );

  const res = await drive.files.create({
    requestBody: {
      name: options.filename,
      mimeType: "text/csv",
      parents: [exportsFolderId],
    },
    media: {
      mimeType: "text/csv",
      body: Readable.from([options.csv]),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  await shareWithWorkspaceDomain(drive, res.data.id!);

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink ?? null,
  };
}

export async function syncStaffToWorkspace(companyId: string) {
  const { staffFolderId, drive, client, rootId } = await ensureWorkspaceFolders(
    companyId
  );
  const sheets = google.sheets({ version: "v4", auth: client });
  const integration = await prisma.googleDriveIntegration.findUniqueOrThrow({
    where: { companyId },
  });

  const { csv, rowCount } = await buildStaffExportCsv(companyId);
  const result = await upsertSpreadsheet({
    drive,
    sheets,
    title: "HR Pay NG — Staff Database",
    folderId: staffFolderId,
    existingId: integration.staffSpreadsheetId,
    rows: csvToRows(csv),
  });

  await prisma.googleDriveIntegration.update({
    where: { companyId },
    data: {
      folderId: rootId,
      staffSpreadsheetId: result.spreadsheetId,
      lastStaffSyncAt: new Date(),
    },
  });

  return {
    type: "staff" as const,
    rowCount,
    spreadsheetId: result.spreadsheetId,
    webViewLink: result.webViewLink,
  };
}

export async function syncPayrollToWorkspace(
  companyId: string,
  runId?: string
) {
  const { payrollFolderId, drive, client, rootId } =
    await ensureWorkspaceFolders(companyId);
  const sheets = google.sheets({ version: "v4", auth: client });
  const integration = await prisma.googleDriveIntegration.findUniqueOrThrow({
    where: { companyId },
  });

  let rows: string[][];
  let rowCount = 0;
  let title = "HR Pay NG — Payroll Database";

  if (runId) {
    const exportData = await buildPayrollExportCsv(companyId, runId);
    rows = csvToRows(exportData.csv);
    rowCount = exportData.rowCount;
    title = `HR Pay NG — Payroll ${exportData.periodLabel}`;
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

  const result = await upsertSpreadsheet({
    drive,
    sheets,
    title,
    folderId: payrollFolderId,
    existingId: runId ? null : integration.payrollSpreadsheetId,
    rows,
  });

  if (!runId) {
    await prisma.googleDriveIntegration.update({
      where: { companyId },
      data: {
        folderId: rootId,
        payrollSpreadsheetId: result.spreadsheetId,
        lastPayrollSyncAt: new Date(),
      },
    });
  }

  return {
    type: "payroll" as const,
    rowCount,
    spreadsheetId: result.spreadsheetId,
    webViewLink: result.webViewLink,
  };
}

export async function getGoogleDriveStatus(companyId: string) {
  const configured = isGoogleWorkspaceConfigured();
  const integration = await prisma.googleDriveIntegration.findUnique({
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
    folderId: integration?.folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? null,
    connectedAt: integration?.connectedAt ?? null,
    staffSpreadsheetId: integration?.staffSpreadsheetId ?? null,
    payrollSpreadsheetId: integration?.payrollSpreadsheetId ?? null,
    lastStaffSyncAt: integration?.lastStaffSyncAt ?? null,
    lastPayrollSyncAt: integration?.lastPayrollSyncAt ?? null,
    workspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN ?? null,
  };
}
