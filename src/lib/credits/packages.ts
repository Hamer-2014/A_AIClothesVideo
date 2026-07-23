export interface CreditPackage {
  code: "starter" | "creator" | "studio";
  name: string;
  creemProductId: string | null;
  amountCents: number;
  currency: "USD";
  credits: number;
}

const creditPackageDefinitions = [
  {
    code: "starter",
    name: "Starter",
    envKey: "CREEM_PRODUCT_ID_STARTER",
    amountCents: 999,
    currency: "USD",
    credits: 100,
  },
  {
    code: "creator",
    name: "Creator",
    envKey: "CREEM_PRODUCT_ID_CREATOR",
    amountCents: 2999,
    currency: "USD",
    credits: 360,
  },
  {
    code: "studio",
    name: "Studio",
    envKey: "CREEM_PRODUCT_ID_STUDIO",
    amountCents: 7999,
    currency: "USD",
    credits: 1100,
  },
] as const;

type EnvSource = Record<string, string | undefined>;

export function getCreditPackages(
  env: EnvSource = process.env,
): CreditPackage[] {
  return creditPackageDefinitions.map(({ envKey, ...item }) => ({
    ...item,
    creemProductId: env[envKey]?.trim() || null,
  }));
}

export const creditPackages = getCreditPackages();

export function getCreditPackage(code: string, env: EnvSource = process.env) {
  return getCreditPackages(env).find((item) => item.code === code) ?? null;
}
