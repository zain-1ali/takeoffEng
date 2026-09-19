import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { problem } from "../common/problem.js";
import { env } from "../config/env.js";

let transport: Transporter | null | undefined;

export function resetMailer(): void {
  transport = undefined;
}

export function mailConfigured(): boolean {
  return Boolean(env().SMTP_HOST);
}

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const settings = env();
  if (settings.NODE_ENV === "test") {
    transport = nodemailer.createTransport({ jsonTransport: true });
    return transport;
  }
  if (!settings.SMTP_HOST) {
    transport = null;
    return null;
  }
  transport = nodemailer.createTransport({
    host: settings.SMTP_HOST,
    port: settings.SMTP_PORT,
    secure: settings.SMTP_SECURE,
    auth: settings.SMTP_USER
      ? { user: settings.SMTP_USER, pass: settings.SMTP_PASS }
      : undefined,
  });
  return transport;
}

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ delivered: boolean }> {
  const settings = env();
  const sender = getTransport();
  if (!sender) {
    if (settings.NODE_ENV === "production") {
      throw problem(
        503,
        "mail_not_configured",
        "Email is not configured",
        "The server cannot send email until SMTP is configured.",
      );
    }
    console.info(`[mail] ${message.subject} -> ${message.to}\n${message.text}`);
    return { delivered: false };
  }
  await sender.sendMail({
    from: settings.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { delivered: true };
}

export async function sendMagicLinkEmail(params: {
  to: string;
  name?: string;
  verifyUrl: string;
}): Promise<void> {
  const minutes = Math.max(1, Math.round(env().MAGIC_LINK_TTL_SECONDS / 60));
  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  const text = [
    greeting,
    "",
    "Use this link to sign in to TakeOff Studio:",
    params.verifyUrl,
    "",
    `This link expires in ${minutes} minutes. If you did not request it, you can ignore this email.`,
  ].join("\n");
  await sendMail({
    to: params.to,
    subject: "Your TakeOff Studio sign-in link",
    text,
    html: emailLayout({
      title: "Sign in to TakeOff Studio",
      intro: greeting,
      body: "Use the button below to sign in. No password is required.",
      actionLabel: "Open sign-in link",
      actionUrl: params.verifyUrl,
      footer: `This link expires in ${minutes} minutes. If you did not request it, you can ignore this email.`,
    }),
  });
}

export async function sendInviteEmail(params: {
  to: string;
  orgName: string;
  role: string;
  acceptUrl: string;
}): Promise<void> {
  const days = Math.max(1, Math.round(env().INVITE_TTL_SECONDS / 86_400));
  const text = [
    "Hi,",
    "",
    `You have been invited to join ${params.orgName} on TakeOff Studio as ${params.role.toLowerCase()}.`,
    params.acceptUrl,
    "",
    `This invitation expires in ${days} day${days === 1 ? "" : "s"}.`,
  ].join("\n");
  await sendMail({
    to: params.to,
    subject: `Join ${params.orgName} on TakeOff Studio`,
    text,
    html: emailLayout({
      title: `Join ${params.orgName}`,
      intro: "Hi,",
      body: `You have been invited to join <strong>${escapeHtml(params.orgName)}</strong> as ${escapeHtml(params.role.toLowerCase())}.`,
      actionLabel: "Accept invitation",
      actionUrl: params.acceptUrl,
      footer: `This invitation expires in ${days} day${days === 1 ? "" : "s"}.`,
    }),
  });
}

function emailLayout(params: {
  title: string;
  intro: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3f4f2;font-family:Barlow,Arial,sans-serif;color:#18232e;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #cdd1cc;border-radius:10px;padding:28px;">
            <tr><td style="font-size:13px;letter-spacing:.04em;color:#5e6973;">TAKEOFF STUDIO</td></tr>
            <tr><td style="padding-top:12px;font-size:24px;font-weight:600;">${escapeHtml(params.title)}</td></tr>
            <tr><td style="padding-top:16px;line-height:1.5;">${escapeHtml(params.intro)}</td></tr>
            <tr><td style="padding-top:8px;line-height:1.5;">${params.body}</td></tr>
            <tr>
              <td style="padding-top:24px;">
                <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;background:#e3a800;color:#18232e;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:6px;">
                  ${escapeHtml(params.actionLabel)}
                </a>
              </td>
            </tr>
            <tr><td style="padding-top:20px;font-size:13px;color:#5e6973;line-height:1.5;">${escapeHtml(params.footer)}</td></tr>
            <tr><td style="padding-top:16px;font-size:12px;color:#5e6973;word-break:break-all;">${escapeHtml(params.actionUrl)}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
