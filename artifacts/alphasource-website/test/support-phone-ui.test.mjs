import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const app = read("src/App.tsx");
const contact = read("src/lib/supportContact.ts");
const contactData = JSON.parse(read("src/lib/support-contact.json"));
const footer = read("src/components/Footer.tsx");
const dashboard = read("src/components/DashboardLayout.tsx");
const supportPage = read("src/pages/SupportPage.tsx");
const publicFaq = read("src/pages/FaqPage.tsx");
const prerender = read("scripts/prerender-public-routes.mjs");
const product = `${contact}\n${footer}\n${dashboard}\n${supportPage}`;

test("support phone contract centralizes the visible number", () => {
  assert.equal(contactData.display, "(605) 599-8008");
  assert.match(contact, /supportContact\.display/);
});

test("support phone contract centralizes the canonical tel URI", () => {
  assert.equal(contactData.uri, "tel:+16055998008");
  assert.match(contact, /supportContact\.uri/);
});

test("public footer renders the AI Customer Support label", () => {
  assert.match(footer, />AI Customer Support</);
});

test("public footer renders the centralized visible number", () => {
  assert.match(footer, /\{AI_SUPPORT_PHONE_DISPLAY\}/);
});

test("public footer uses the canonical telephone URI", () => {
  assert.match(footer, /href=\{AI_SUPPORT_PHONE_URI\}/);
});

test("public footer phone link has a purpose-specific accessible label", () => {
  assert.match(footer, /aria-label=\{AI_SUPPORT_PHONE_LABEL\}/);
});

test("one shared footer serves the public layout", () => {
  assert.equal((app.match(/<Footer\s*\/>/g) || []).length, 1);
});

test("prerendered public snapshots use the same canonical support contract", () => {
  assert.match(prerender, /support-contact\.json/);
  assert.match(prerender, /<strong>AI Customer Support<\/strong>/);
  assert.match(prerender, /href="\$\{escapeAttr\(AI_SUPPORT_PHONE_URI\)\}"/);
});

test("prerendered Support content exposes the secondary phone channel", () => {
  assert.match(prerender, /Call AI Customer Support at \$\{AI_SUPPORT_PHONE_DISPLAY\}/);
});

test("one phone entry is rendered in the shared footer", () => {
  assert.equal((footer.match(/AI_SUPPORT_PHONE_DISPLAY/g) || []).length, 2);
  assert.equal((footer.match(/href=\{AI_SUPPORT_PHONE_URI\}/g) || []).length, 1);
});

test("dashboard renders a compact Support trigger", () => {
  assert.match(dashboard, /aria-label="Open AI Customer Support"/);
  assert.match(dashboard, /<span className="hidden sm:inline">Support<\/span>/);
});

test("dashboard support panel is initially closed and controlled by Radix Popover", () => {
  assert.match(dashboard, /<Popover>/);
  assert.doesNotMatch(dashboard, /defaultOpen|open=\{true\}/);
});

test("dashboard Support trigger opens the associated popover", () => {
  assert.match(dashboard, /<PopoverTrigger asChild>/);
  assert.match(dashboard, /<PopoverContent/);
});

test("dashboard panel shows the AI Customer Support number", () => {
  assert.match(dashboard, /Need help\? Call our AI Customer Support line\./);
  assert.match(dashboard, /\{AI_SUPPORT_PHONE_DISPLAY\}/);
});

test("dashboard call link uses the canonical telephone URI and label", () => {
  assert.match(dashboard, /href=\{AI_SUPPORT_PHONE_URI\}/);
  assert.match(dashboard, /aria-label=\{AI_SUPPORT_PHONE_LABEL\}/);
});

test("dashboard panel retains keyboard and Escape closing through Radix", () => {
  assert.match(read("src/components/ui/popover.tsx"), /@radix-ui\/react-popover/);
  assert.match(dashboard, /<PopoverContent[\s\S]*aria-label="AI Customer Support contact"/);
});

test("dashboard Help Center remains navigable without duplicating the quick-support purpose", () => {
  assert.match(dashboard, /label: "Help Center", href: "\/dashboard\/support"/);
  assert.match(dashboard, /View Help Center/);
});

test("dashboard popover is constrained for narrow viewports", () => {
  assert.match(dashboard, /w-\[calc\(100vw-2rem\)\] max-w-72/);
});

test("existing public support page includes secondary phone support", () => {
  assert.match(supportPage, />AI Customer Support</);
  assert.match(supportPage, /href=\{AI_SUPPORT_PHONE_URI\}/);
});

test("public FAQ is not expanded with a duplicate phone block", () => {
  assert.doesNotMatch(publicFaq, /605\) 599-8008|AI_SUPPORT_PHONE/);
});

test("phase one adds no xAI, microphone, websocket, or tracking behavior", () => {
  assert.doesNotMatch(product, /XAI_API_KEY|api\.x\.ai|WebSocket|mediaDevices|getUserMedia/);
  assert.doesNotMatch(contact, /fetch\(|XMLHttpRequest|analytics|tracking/i);
});
