export type AdminRole = "admin" | "operator";

export type AdminAction =
  | "job:retry_segment"
  | "job:reopen_post_qa"
  | "job:mark_undeliverable"
  | "job:refund"
  | "template:update_status"
  | "provider_key:update"
  | "model_route:update"
  | "pricing:update"
  | "credits:admin_adjust";

const operatorAllowedActions = new Set<AdminAction>([
  "job:retry_segment",
  "job:reopen_post_qa",
  "job:mark_undeliverable",
  "job:refund",
  "template:update_status",
  "credits:admin_adjust",
]);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseAdminAllowlist(value = process.env.ADMIN_EMAIL_ALLOWLIST) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
}

export function isEmailAllowedForAdmin(
  email: string | null | undefined,
  allowlist = process.env.ADMIN_EMAIL_ALLOWLIST,
) {
  if (!email) {
    return false;
  }

  return parseAdminAllowlist(allowlist).includes(normalizeEmail(email));
}

export function canRolePerformAdminAction(role: AdminRole, action: AdminAction) {
  if (role === "admin") {
    return true;
  }

  return operatorAllowedActions.has(action);
}
