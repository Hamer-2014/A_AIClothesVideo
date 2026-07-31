type AuthSession = {
  user?: {
    id?: string;
  };
} | null;

interface NavItem {
  href: string;
  label: string;
  active: boolean;
}

interface ProviderLike {
  id: string;
  displayName: string;
}

interface ProviderKeyLike {
  id: string;
  providerId: string;
  label: string;
}

interface TemplateSeedLike {
  templateId: string;
  version: number;
  displayName: string;
  riskLevel: string;
  status: string;
  isTrialAllowed: boolean;
}

interface TemplateRecordLike {
  templateId: string;
  version: number;
  displayName: string;
  riskLevel: string;
  status: string;
  isTrialAllowed: boolean;
}

export function pickWorkspaceRedirect(session: AuthSession) {
  return session?.user?.id ? "/workspace" : "/login";
}

export function buildDashboardNav(
  pathname: string,
  language?: SiteLocale,
): NavItem[] {
  const normalizedPathname = stripLocalePrefix(pathname);
  const labels = language === "en"
    ? { workspace: "Workspace", virtualTryOn: "Virtual try-on", jobs: "Jobs", billing: "Billing" }
    : { workspace: "工作台", virtualTryOn: "虚拟试穿", jobs: "任务", billing: "账单" };
  const workspaceHref = language
    ? localizeHref("/workspace", language)
    : "/workspace";
  const virtualTryOnHref = language
    ? localizeHref("/virtual-try-on", language)
    : "/virtual-try-on";

  return [
    { href: workspaceHref, label: labels.workspace, active: normalizedPathname === "/workspace" },
    { href: virtualTryOnHref, label: labels.virtualTryOn, active: normalizedPathname === "/virtual-try-on" || normalizedPathname.startsWith("/virtual-try-on/") },
    { href: "/jobs", label: labels.jobs, active: normalizedPathname.startsWith("/jobs") },
    { href: "/billing", label: labels.billing, active: normalizedPathname === "/billing" },
  ];
}

export function buildAdminNav(pathname: string): NavItem[] {
  return [
    { href: "/admin", label: "总览", active: pathname === "/admin" },
    { href: "/admin/jobs", label: "任务", active: pathname.startsWith("/admin/jobs") },
    {
      href: "/admin/providers",
      label: "供应商",
      active: pathname.startsWith("/admin/providers"),
    },
    {
      href: "/admin/billing",
      label: "点数",
      active: pathname.startsWith("/admin/billing"),
    },
    {
      href: "/admin/funnel",
      label: "漏斗",
      active: pathname.startsWith("/admin/funnel"),
    },
    {
      href: "/admin/templates",
      label: "模板",
      active: pathname.startsWith("/admin/templates"),
    },
    {
      href: "/admin/audit-logs",
      label: "审计",
      active: pathname.startsWith("/admin/audit-logs"),
    },
    {
      href: "/admin/rights-removal",
      label: "侵权处理",
      active: pathname.startsWith("/admin/rights-removal"),
    },
  ];
}

export function groupProviderKeysByProvider(input: {
  providers: ProviderLike[];
  keys: ProviderKeyLike[];
}) {
  return input.providers.map((provider) => ({
    providerId: provider.id,
    providerName: provider.displayName,
    keys: input.keys.filter((key) => key.providerId === provider.id),
  }));
}

export function buildTemplateStatusRows(
  seededTemplates: TemplateSeedLike[],
  persistedTemplates: TemplateRecordLike[],
) {
  const persistedByKey = new Map(
    persistedTemplates.map((template) => [
      `${template.templateId}:${template.version}`,
      template,
    ]),
  );

  return seededTemplates
    .map((template) => {
      const persisted = persistedByKey.get(
        `${template.templateId}:${template.version}`,
      );

      return persisted ?? template;
    })
    .sort((left, right) => left.templateId.localeCompare(right.templateId));
}
import { localizeHref, stripLocalePrefix, type SiteLocale } from "@/lib/i18n/config";
