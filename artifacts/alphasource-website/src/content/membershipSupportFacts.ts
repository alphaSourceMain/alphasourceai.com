// Read-only Help copy projection of membershipOffers.js at QA backend
// a67db51cf62e7b541f793411a085a4e84e2c1c67, offer retail-stripe-terms-2026-10-15-v3.
// Not a checkout catalog: purchase forms continue to use the existing server API.
// Release verification compares every field below against buildRetailOffer.
export const MEMBERSHIP_SUPPORT_FACTS = {
  months: [3, 6, 12],
  essential: { prepaidCents: [120000, 195000, 330000], roleCents: 39900,
    extraCents: 2500, interviews: 20, minutes: 10, questions: 5, firstRoleCents: 35900 },
  pro: { prepaidCents: [210000, 360000, 650000], roleCents: 69900,
    extraCents: 3000, interviews: 30, minutes: 12, questions: 6, firstRoleCents: 62900, rolloverDays: 90 },
} as const;

export function supportDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
