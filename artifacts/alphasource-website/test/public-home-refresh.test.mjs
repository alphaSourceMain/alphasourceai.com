import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("src/App.tsx");
const appearance = read("src/components/AppearanceSelector.tsx");
const navbar = read("src/components/Navbar.tsx");
const footer = read("src/components/Footer.tsx");
const styles = read("src/index.css");
const home = read("src/pages/B1HomePage.tsx");
const b1 = read("src/pages/b1-home.css");
const about = read("src/pages/AboutPage.tsx");
const alphaScreen = read("src/pages/AlphaScreenPage.tsx");

test("all public marketing routes including home share appearance and chrome", () => {
  assert.match(appearance, /value: "light"/);
  assert.match(appearance, /value: "dark"/);
  assert.match(appearance, /value: "system"/);
  assert.match(appearance, /alwaysShowLabel/);
  assert.match(navbar, /<AppearanceSelector \/>/);
  assert.doesNotMatch(navbar, /isHomePage && <AppearanceSelector/);
  assert.match(app, /data-theme=\{resolvedMode\}/);
  assert.doesNotMatch(app, /location !== "\/" && <(?:Navbar|Footer)/);
  assert.match(app, /public-site-rest/);
  assert.match(app, /resolvedMode === "dark"/);
});

test("approved rest-of-site treatment keeps the footer and theme provider-neutral", () => {
  assert.match(footer, /const EXPLORE_LINKS/);
  assert.match(footer, /const PRODUCT_LINKS/);
  assert.match(footer, /Agentic AI that enhances human judgment — helping teams reclaim time and spot potential in every talent interaction\./);
  assert.match(footer, />Email us</);
  assert.match(footer, />AI Customer Support</);
  assert.match(footer, /AI_SUPPORT_PHONE_DISPLAY/);
  assert.match(styles, /\.public-site-rest\.dark main/);
  assert.match(styles, /\.dark \.gradient-hero-bg/);
});

test("dark technology copy and how-it-works card sizing remain consistent", () => {
  assert.match(about, /font-semibold text-\[#0A1547\]/);
  assert.match(about, /text-\[#0A1547\]\/70/);
  assert.doesNotMatch(about, /color: item\.weight === "semibold"/);
  assert.match(alphaScreen, /min-h-\[10\.625rem\] h-full bg-white rounded-2xl/);
});

test("live homepage follows approved B1 structure, supplied assets and exact copy", () => {
  assert.match(app, /import HomePage from "@\/pages\/B1HomePage"/);
  assert.match(home, /className="hero wrap"/);
  assert.match(home, /className="stats"/);
  assert.match(home, /<main id="home-content">/);
  assert.doesNotMatch(home, /<footer|<nav/);
  assert.match(footer, /aria-label="LinkedIn"/);
  assert.match(footer, /aria-label="Facebook"/);
  assert.match(home, /Illustrative workflow/);
  assert.doesNotMatch(navbar, /nav-logo|<img/);
  assert.match(home, /\/brand\/b1\/alpha-v4\.svg/);
  assert.match(home, /Unleash your/);
  assert.doesNotMatch(home, /dangerouslySetInnerHTML|<iframe/);
});

test("B1 reveals fail open and shared mobile navigation preserves focus boundaries", () => {
  assert.match(b1, /prefers-reduced-motion:\s*reduce/);
  assert.match(b1, /\.b1-home \.r \{\s*opacity: 1/);
  assert.doesNotMatch(home, /IntersectionObserver|menuOpen|<nav|AI-powered solutions/);
  assert.match(navbar, /event.key === "Escape"/);
  assert.match(navbar, /event.key !== "Tab"/);
  assert.match(navbar, /element.inert = inert/);
  assert.match(navbar, /window.cancelAnimationFrame/);
  assert.match(app, /MotionConfig reducedMotion="user"/);
});

test("B1 visual system covers shared chrome and the rest of the site", () => {
  const site = read("src/b1-site.css");
  const entry = read("src/main.tsx");
  assert.match(entry, /import "\.\/b1-site\.css"/);
  assert.doesNotMatch(read("index.html"), /class="b1-theme"/);
  assert.match(site, /\.b1-public-scope \{[\s\S]*--b1-night/);
  assert.doesNotMatch(site, /html|\.as-app-shell|--sidebar|--chart/);
  assert.doesNotMatch(site, /:is\(aside, footer, nav\)/);
  assert.match(site, /\.b1-footer a:hover \{\s*color: #fff !important/);
  assert.match(app, /isDashboard \|\| isAdmin \|\| isSales \|\| isInterview \|\| isAutomationApproval \|\| isAutomationDigestApproval \? content : <div className="b1-public-scope">/);
  assert.match(read("src/pages/sales/SalesSignInPage.tsx"), /className="b1-public-scope/);
  assert.match(site, /--b1-night: #050a1f/);
  assert.match(site, /--b1-mint: #19e3b1/);
  assert.match(site, /--b1-sky: #18b4f0/);
  assert.match(site, /font-family: Sora/);
  assert.match(navbar, /className=\{`b1-nav/);
  assert.match(footer, /b1-footer/);
  assert.match(styles, /\.dark \.gradient-hero-bg/);
});

test("public routes, contact form, and sign-in affordances remain wired", () => {
  for (const href of ["/", "/about/", "/alphascreen", "/alphascreen/how-it-works", "/#contact", "/faq"]) {
    assert.match(navbar, new RegExp(`href: "${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(home, /<LeadCaptureForm/);
  assert.match(home, /formId="home-contact"/);
  assert.match(navbar, /data-testid="nav-login-button"/);
});

test("signed-in global styles and boot HTML retain the accepted B1 baseline", () => {
  const hash = path => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
  assert.equal(hash("src/index.css"), "cb500560a599cf1ed1a86b5fbeff5467e336b8b19db7392288d627439f01c57a");
  assert.equal(hash("index.html"), "9d9209a12321e8930d33db6110156529f7f060fd0b40039752334c881ce5d9b8");
  assert.doesNotMatch(read("src/pages/sales/SalesApp.tsx"), /b1-public-scope/);
  assert.match(navbar, /document.body.style.overflow = "hidden"/);
  assert.match(navbar, /document.body.style.overflow = previousOverflow/);
  assert.match(navbar, /mobileButtonRef.current\?\.focus\(/);
  assert.match(navbar, /event.key !== "Tab"/);
});
