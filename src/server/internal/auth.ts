export function getInternalWorkerSecret() {
  return process.env.INTERNAL_WORKER_SECRET;
}

export function getBearerOrHeaderSecret(request: Request) {
  return (
    request.headers.get("x-worker-secret") ??
    request.headers.get("x-internal-worker-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export function isInternalWorkerAuthorized({
  request,
  expectedSecret = getInternalWorkerSecret(),
}: {
  request: Request;
  expectedSecret?: string | null;
}) {
  return Boolean(expectedSecret) && getBearerOrHeaderSecret(request) === expectedSecret;
}
