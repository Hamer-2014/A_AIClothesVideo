import type { StitchResult } from "./http.js";

export async function sendStitchCallback({
  callbackUrl,
  workerSecret,
  result,
  fetch: fetchImpl = fetch,
}: {
  callbackUrl: string;
  workerSecret: string;
  result: StitchResult;
  fetch?: typeof fetch;
}) {
  const response = await fetchImpl(callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    throw new Error(`Stitch callback failed with status ${response.status}.`);
  }
}
