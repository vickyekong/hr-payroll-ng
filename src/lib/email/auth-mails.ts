import { PRODUCT_NAME } from "@/lib/brand";
import { appUrl } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";

function wrapHtml(body: string): string {
  return `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0b2e33;max-width:32rem">
    <p style="font-size:1.125rem;font-weight:600">${PRODUCT_NAME}</p>
    ${body}
    <p style="margin-top:2rem;font-size:0.75rem;color:#5c7270">If you did not request this, you can ignore this email.</p>
  </div>`;
}

export async function sendVerificationEmail(options: {
  to: string;
  name: string;
  token: string;
}) {
  const link = appUrl(`/verify-email?token=${encodeURIComponent(options.token)}`);
  return sendEmail({
    to: options.to,
    subject: `Verify your ${PRODUCT_NAME} email`,
    html: wrapHtml(`
      <p>Hi ${options.name},</p>
      <p>Confirm your email to sign in to your workspace.</p>
      <p><a href="${link}" style="color:#14919b">Verify email</a></p>
      <p style="font-size:0.875rem;color:#5c7270">Link expires in 48 hours.</p>
    `),
    text: `Hi ${options.name},\n\nVerify your email: ${link}\n\nLink expires in 48 hours.`,
  });
}

export async function sendPasswordResetEmail(options: {
  to: string;
  name: string;
  token: string;
}) {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(options.token)}`);
  return sendEmail({
    to: options.to,
    subject: `Reset your ${PRODUCT_NAME} password`,
    html: wrapHtml(`
      <p>Hi ${options.name},</p>
      <p>We received a request to reset your password.</p>
      <p><a href="${link}" style="color:#14919b">Choose a new password</a></p>
      <p style="font-size:0.875rem;color:#5c7270">Link expires in 1 hour.</p>
    `),
    text: `Hi ${options.name},\n\nReset password: ${link}\n\nLink expires in 1 hour.`,
  });
}

export async function sendTeamInviteEmail(options: {
  to: string;
  name: string;
  companyName: string;
  inviterName: string;
  roleLabel: string;
  token: string;
}) {
  const link = appUrl(`/accept-invite?token=${encodeURIComponent(options.token)}`);
  return sendEmail({
    to: options.to,
    subject: `Join ${options.companyName} on ${PRODUCT_NAME}`,
    html: wrapHtml(`
      <p>Hi ${options.name},</p>
      <p>${options.inviterName} invited you to ${options.companyName} as <strong>${options.roleLabel}</strong>.</p>
      <p><a href="${link}" style="color:#14919b">Accept invite &amp; set password</a></p>
      <p style="font-size:0.875rem;color:#5c7270">Invite expires in 7 days.</p>
    `),
    text: `Hi ${options.name},\n\n${options.inviterName} invited you to ${options.companyName} as ${options.roleLabel}.\n\nAccept: ${link}`,
  });
}
