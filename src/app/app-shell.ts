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

export function buildDashboardNav(pathname: string): NavItem[] {
  return [
    { href: "/workspace", label: "工作台", active: pathname === "/workspace" },
    { href: "/jobs", label: "任务", active: pathname.startsWith("/jobs") },
    { href: "/billing", label: "账单", active: pathname === "/billing" },
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
