import { Readable } from "stream";
import { google } from "googleapis";
import { prisma } from "@/lib/db";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function getGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Drive is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
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
    throw new Error("NEXTAUTH_URL is required for Google Drive OAuth");
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
      "No refresh token returned. Disconnect the app in Google Account permissions and reconnect."
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
    throw new Error("Google Drive is not connected. Connect it in Settings.");
  }

  const client = getGoogleOAuthClient();
  client.setCredentials({ refresh_token: integration.refreshToken });
  return { client, integration };
}

export async function uploadCsvToGoogleDrive(options: {
  companyId: string;
  filename: string;
  csv: string;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const { client, integration } = await getAuthorizedClient(options.companyId);
  const drive = google.drive({ version: "v3", auth: client });

  const requestBody: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name: options.filename,
    mimeType: "text/csv",
  };

  const folderId =
    integration.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;
  if (folderId) {
    requestBody.parents = [folderId];
  }

  const res = await drive.files.create({
    requestBody,
    media: {
      mimeType: "text/csv",
      body: Readable.from([options.csv]),
    },
    fields: "id, webViewLink",
  });

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink ?? null,
  };
}

export async function getGoogleDriveStatus(companyId: string) {
  const configured = isGoogleDriveConfigured();
  const integration = await prisma.googleDriveIntegration.findUnique({
    where: { companyId },
    select: {
      email: true,
      folderId: true,
      connectedAt: true,
    },
  });

  return {
    configured,
    connected: Boolean(integration),
    email: integration?.email ?? null,
    folderId: integration?.folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? null,
    connectedAt: integration?.connectedAt ?? null,
  };
}
