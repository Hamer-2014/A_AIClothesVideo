import { getServerSession } from "@/lib/auth/server";

import {
  isEmailAllowedForAdmin,
  type AdminRole,
} from "./admin-access";

type AuthSession = {
  user?: {
    id?: string;
    email?: string | null;
  };
} | null;

export interface AdminSession {
  userId: string;
  email: string;
  role: AdminRole;
}

export function getAdminSessionFromAuthSession(
  session: AuthSession,
  allowlist = process.env.ADMIN_EMAIL_ALLOWLIST,
): AdminSession | null {
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email || !isEmailAllowedForAdmin(email, allowlist)) {
    return null;
  }

  return {
    userId,
    email,
    role: "admin",
  };
}

export async function getAdminSession() {
  return getAdminSessionFromAuthSession(await getServerSession());
}
