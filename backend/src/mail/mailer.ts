import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { problem } from "../common/problem.js";
import { env } from "../config/env.js";

let transport: Transporter | null | undefined;

export function resetMailer(): void {
  transport = undefined;
}

export function mailConfigured(): boolean {
  const settings = env();
  return Boolean(settings.RESEND_API_KEY || settings.SMTP_HOST);
}

function smtpTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const settings = env();
  if (settings.NODE_ENV === "test" && !settings.RESEND_API_KEY) {
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
    secure: settings.SMTP_SECURE || settings.SMTP_PORT === 465,
    auth: settings.SMTP_USER
      ? { user: settings.SMTP_USER, pass: settings.SMTP_PASS.replaceAll(" ", "") }
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
  if (settings.RESEND_API_KEY) {
    await sendWithResend(message, settings.RESEND_API_KEY);
    return { delivered: true };
  }

  const sender = smtpTransport();
  if (!sender) {
    if (settings.NODE_ENV === "production") {
      throw problem(
        503,
        "mail_not_configured",
        "Email is not configured",
        "Railway blocks Gmail SMTP. Set RESEND_API_KEY and send mail over HTTPS.",
      );
    }
    console.info(`[mail] ${message.subject} -> ${message.to}\n${message.text}`);
    return { delivered: false };
  }

  try {
    await sender.sendMail({
      from: mailFrom(),
      to: message.to,
      replyTo: mailReplyTo() || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[mail] send failed", raw);
    throw problem(502, "mail_failed", "Email could not be sent", raw);
  }
  return { delivered: true };
}

async function sendWithResend(
  message: { to: string; subject: string; text: string; html: string },
  apiKey: string,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [message.to],
      reply_to: mailReplyTo() || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("[mail] Resend failed", response.status, body);
    throw problem(502, "mail_failed", "Email could not be sent", body.slice(0, 300));
  }
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
    "Someone requested a sign-in to TakeOff Studio for this email address.",
    "If that was you, open the address below to continue. You do not need a password.",
    "",
    params.verifyUrl,
    "",
    `This sign-in expires in ${minutes} minutes.`,
    "If you did not ask for this, you can ignore the message. Nobody can sign in without this email.",
    "",
    "TakeOff Studio",
  ].join("\n");
  await sendMail({
    to: params.to,
    subject: "Sign in to TakeOff Studio",
    text,
    html: emailLayout({
      title: "Sign in to TakeOff Studio",
      intro: greeting,
      body: "Someone requested a sign-in for this email address. If that was you, continue below. You do not need a password.",
      actionLabel: "Continue sign-in",
      actionUrl: params.verifyUrl,
      footer: `This sign-in expires in ${minutes} minutes. If you did not ask for this, ignore the message.`,
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

function mailFrom(): string {
  const settings = env();
  const configured = (settings.MAIL_FROM || settings.SMTP_FROM).trim();
  if (isPlaceholderFrom(configured)) {
    if (settings.RESEND_API_KEY) {
      console.warn(
        "[mail] MAIL_FROM is not a verified domain address. Shared Resend senders often land in spam. Set MAIL_FROM to an address on a domain you verified in Resend.",
      );
      return "TakeOff Studio <onboarding@resend.dev>";
    }
    if (settings.SMTP_USER) return `TakeOff Studio <${settings.SMTP_USER}>`;
  }
  return configured;
}

function mailReplyTo(): string {
  const settings = env();
  if (settings.MAIL_REPLY_TO.trim()) return settings.MAIL_REPLY_TO.trim();
  const from = mailFrom();
  const match = from.match(/<([^>]+)>/);
  return match?.[1] ?? from;
}

function isPlaceholderFrom(value: string): boolean {
  return (
    !value.includes("@") ||
    value.includes("you@gmail.com") ||
    value.includes("noreply@takeoff.local") ||
    value.includes("onboarding@resend.dev")
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
