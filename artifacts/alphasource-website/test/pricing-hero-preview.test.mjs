import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pricing = readFileSync(resolve(root, "src/pages/AlphaScreenPricingPage.tsx"), "utf8");

test("pricing hero uses the approved static teal lockup on the dark band", () => {
  assert.match(pricing, /<section className="pr-band" aria-labelledby="pricing-title"/);
  assert.match(pricing, /<AlphaScreenLockup treatment="teal" wordmarkTone="white"/);
  assert.doesNotMatch(pricing, /alphaScreen memberships|Included interview volume/);
});

test("plan cards retain volume and time caps after removing the hero summary", () => {
  assert.ok(pricing.includes('value={`${included} interviews per role`}'));
  assert.ok(pricing.includes('value={`${duration}-minute interviews`}'));
});

test("Enterprise card remains present without a duplicate volume summary", () => {
  assert.match(pricing, /<EnterpriseCard \/>/);
  assert.match(pricing, /Fully customizable to your organization/);
  assert.doesNotMatch(pricing, /Custom membership/);
});
