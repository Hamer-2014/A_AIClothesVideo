const storageKey = "runwaytools_device_id";

function createDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateDeviceFingerprint() {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const created = createDeviceId();
  window.localStorage.setItem(storageKey, created);
  return created;
}
