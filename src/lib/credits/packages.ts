export interface CreditPackage {
  code: "starter" | "creator" | "studio";
  name: string;
  creemProductId: string;
  amountCents: number;
  currency: "USD";
  credits: number;
}

export const creditPackages: CreditPackage[] = [
  {
    code: "starter",
    name: "Starter",
    creemProductId: "starter",
    amountCents: 999,
    currency: "USD",
    credits: 100,
  },
  {
    code: "creator",
    name: "Creator",
    creemProductId: "creator",
    amountCents: 2999,
    currency: "USD",
    credits: 360,
  },
  {
    code: "studio",
    name: "Studio",
    creemProductId: "studio",
    amountCents: 7999,
    currency: "USD",
    credits: 1100,
  },
];

export function getCreditPackage(code: string) {
  return creditPackages.find((item) => item.code === code) ?? null;
}
