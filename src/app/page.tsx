import { redirect } from "next/navigation";

import { pickWorkspaceRedirect } from "./app-shell";
import { getServerSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession();
  redirect(pickWorkspaceRedirect(session));
}
