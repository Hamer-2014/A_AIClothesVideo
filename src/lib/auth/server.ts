import { headers } from "next/headers";

import { getAuth } from "./config";

export async function getServerSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}
