import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("src/App.tsx");
const appearance = read("src/components/AppearanceSelector.tsx");
const navbar = read("src/components/Navbar.tsx");
const home = read("src/pages/HomePage.tsx");

test("public homepage exposes the dashboard-style appearance contract", () => {
  assert.match(appearance, /value: "light"/);
  assert.match(appearance, /value: "dark"/);
  assert.match(appearance, /value: "system"/);
  assert.match(appearance, /alwaysShowLabel/);
  assert.match(navbar, /isHomePage && <AppearanceSelector \/>/);
  assert.match(navbar, /<AppearanceSelector alwaysShowLabel \/>/);
  assert.match(app, /const activeMode = isHomePage \? resolvedMode : "light"/);
});

test("approved homepage structure keeps the continuous dark value band", () => {
  assert.match(home, /function ValueBandSection\(\)/);
  assert.match(home, /bg-\[#070E36\]/);
  assert.match(home, /<HeroSection \/>\s*<ValueBandSection \/>\s*<PeopleDrivenSection \/>/);
  assert.match(home, /dark:bg-\[#09133E\]/);
  assert.match(home, /dark:bg-\[#0D1A4A\]/);
});

test("owner-approved hero and alphaScreen motion timings remain intact", () => {
  assert.match(home, /animate=\{\{ y: \[0, -10, 0\] \}\}/);
  assert.match(home, /duration: 5, repeat: Infinity/);
  assert.match(home, /duration: 4\.5/);
  assert.match(home, /duration: 3\.8/);
  assert.match(home, /delay: 0\.2/);
  assert.match(home, /delay: 0\.7/);
  assert.match(home, /delay: 1\.2/);
  assert.match(home, /delay: 1\.7/);
  assert.match(home, /delay: 2\.2, duration: 0\.5/);
});

test("public routes, contact form, and sign-in affordances remain wired", () => {
  for (const href of ["/", "/about", "/alphascreen", "/alphascreen/how-it-works", "/#contact", "/faq"]) {
    assert.match(navbar, new RegExp(`href: "${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(home, /<LeadCaptureForm/);
  assert.match(home, /formId="home-contact"/);
  assert.match(navbar, /data-testid="nav-login-button"/);
});
