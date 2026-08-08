import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const raw =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "omnipeople-dev-only-token-key";
  return createHash("sha256").update(raw).digest();
}

/** Encrypt a secret for DB storage (AES-256-GCM). Idempotent if already encrypted. */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    Buffer.concat([iv, tag, encrypted]).toString("base64url")
  );
}

/**
 * Decrypt a secret from DB. Plaintext values (pre-migration) are returned as-is
 * so existing Google tokens keep working until reconnected.
 */
export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}
