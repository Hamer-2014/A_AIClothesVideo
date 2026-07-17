import { Resend } from "resend";

import type { RightsRemovalRequestRecord } from "./rights-removal";

type RightsRemovalEmailEnv = Record<string, string | undefined>;

export interface RightsRemovalEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export function getRightsRemovalEmailConfig(
  env: RightsRemovalEmailEnv = process.env,
) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  const legalContactEmail = env.LEGAL_CONTACT_EMAIL?.trim();
  if (!apiKey || !from || !legalContactEmail) {
    throw new Error("rights_removal_email_config_required");
  }

  return {
    apiKey,
    from,
    legalContactEmail,
    appUrl: env.APP_URL?.trim().replace(/\/+$/, "") || "http://localhost:3000",
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRightsRemovalEmail(
  record: RightsRemovalRequestRecord,
  appUrl: string,
) {
  const adminUrl = `${appUrl}/admin/rights-removal`;
  const references = record.contentReferences.map((reference) => `- ${reference}`);
  const text = [
    `收到新的权利通知：${record.publicReference}`,
    `权利类型：${record.rightsType}`,
    "内容引用：",
    ...references,
    `后台处理：${adminUrl}`,
  ].join("\n");
  const htmlReferences = record.contentReferences
    .map((reference) => `<li>${escapeHtml(reference)}</li>`)
    .join("");

  return {
    subject: `[RunwayTools 权利通知] ${record.publicReference}`,
    text,
    html: `<p>收到新的权利通知：<strong>${escapeHtml(record.publicReference)}</strong></p><p>权利类型：${escapeHtml(record.rightsType)}</p><ul>${htmlReferences}</ul><p><a href="${escapeHtml(adminUrl)}">进入后台处理</a></p>`,
  };
}

export async function sendRightsRemovalNotification(
  record: RightsRemovalRequestRecord,
  options: {
    env?: RightsRemovalEmailEnv;
    sendEmail?: (payload: RightsRemovalEmailPayload) => Promise<unknown>;
  } = {},
) {
  const config = getRightsRemovalEmailConfig(options.env);
  const content = buildRightsRemovalEmail(record, config.appUrl);
  const payload: RightsRemovalEmailPayload = {
    from: config.from,
    to: [config.legalContactEmail],
    ...content,
  };

  if (options.sendEmail) {
    await options.sendEmail(payload);
    return;
  }

  const resend = new Resend(config.apiKey);
  const { error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(error.message);
  }
}

function sanitizeProviderError(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/https?:\/\/[^\s?#]+[?#][^\s]*/gi, "[REDACTED_URL]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 200);
}

export async function recordRightsRemovalNotificationFailure(input: {
  publicReference: string;
  errorCode: "rights_removal_notification_failed";
  errorMessage: string;
}) {
  console.error(input.errorCode, {
    publicReference: input.publicReference,
    providerError: sanitizeProviderError(input.errorMessage),
  });
}
