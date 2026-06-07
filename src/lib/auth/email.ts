import { Resend } from "resend";

export type AuthEmailEnv = Record<string, string | undefined>;

export type OtpEmailType = "sign-in" | "email-verification" | "forget-password";

export interface AuthEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function getResendEmailConfig(env: AuthEmailEnv = process.env) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send authentication email.");
  }

  if (!env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is required to send authentication email.");
  }

  return {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  };
}

export function buildOtpEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: OtpEmailType;
}): AuthEmailContent {
  const purpose =
    type === "email-verification"
      ? "验证邮箱"
      : type === "forget-password"
        ? "账号验证"
        : "登录验证码";

  return {
    subject: `RunwayTools ${purpose}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #171715;">
        <p>${email}，你好。</p>
        <p>你的 RunwayTools ${purpose}是：</p>
        <p style="font-size: 28px; letter-spacing: 4px; font-weight: 700;">${otp}</p>
        <p>验证码有效期约 10 分钟。如果不是你本人操作，可以忽略这封邮件。</p>
      </div>
    `,
    text: `${email}，你好。\n\n你的 RunwayTools ${purpose}是：${otp}\n\n验证码有效期约 10 分钟。如果不是你本人操作，可以忽略这封邮件。`,
  };
}

export function buildMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}): AuthEmailContent {
  return {
    subject: "RunwayTools 登录链接",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #171715;">
        <p>${email}，你好。</p>
        <p>点击下面的链接登录 RunwayTools：</p>
        <p><a href="${url}">${url}</a></p>
        <p>链接有效期较短。如果不是你本人操作，可以忽略这封邮件。</p>
      </div>
    `,
    text: `${email}，你好。\n\n点击下面的链接登录 RunwayTools：\n${url}\n\n链接有效期较短。如果不是你本人操作，可以忽略这封邮件。`,
  };
}

export async function sendAuthEmail({
  to,
  content,
}: {
  to: string;
  content: AuthEmailContent;
}) {
  const config = getResendEmailConfig();
  const resend = new Resend(config.apiKey);
  const { data, error } = await resend.emails.send({
    from: config.from,
    to: [to],
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    provider: "resend" as const,
    providerMessageId: data?.id ?? null,
  };
}
