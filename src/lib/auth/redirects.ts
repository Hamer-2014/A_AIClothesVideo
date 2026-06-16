export const authRedirectFallback = "/workspace";

type QueryValue = string | string[] | undefined;

export function sanitizeAuthRedirect(next: string | null | undefined) {
  if (!next) {
    return authRedirectFallback;
  }

  let decodedNext = next;
  try {
    decodedNext = decodeURIComponent(next);
  } catch {
    decodedNext = next;
  }

  if (
    !decodedNext.startsWith("/") ||
    decodedNext.startsWith("//") ||
    decodedNext.includes("\\") ||
    decodedNext.includes("\u0000")
  ) {
    return authRedirectFallback;
  }

  return decodedNext;
}

export function buildLoginHrefForRedirect(next: string | null | undefined) {
  return `/login?next=${encodeURIComponent(sanitizeAuthRedirect(next))}`;
}

export function buildRelativePathWithQuery(
  pathname: string,
  searchParams?: Record<string, QueryValue>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item.length > 0) {
          query.append(key, item);
        }
      }
    }
  }

  const serializedQuery = query.toString();
  return serializedQuery ? `${pathname}?${serializedQuery}` : pathname;
}
