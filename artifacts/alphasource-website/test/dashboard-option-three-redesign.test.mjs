import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const layout = read("src/components/DashboardLayout.tsx");
const overview = read("src/pages/dashboard/OverviewPage.tsx");
const support = read("src/components/SupportVoicePopover.tsx");

test("option three shell keeps the client selector in the header", () => {
  const header = layout.slice(layout.indexOf("<header"), layout.indexOf("</header>"));
  assert.match(header, /clientDropdownOpen/);
  assert.match(layout, /selectedClient\.name/);
  assert.match(layout, /Search clients|clientSearchPlaceholder/);
});

test("option three shell includes the tour card and sidebar support action", () => {
  assert.match(layout, /Quick guide/i);
  assert.match(layout, /Need a refresher\?/);
  assert.match(layout, /Replay the dashboard tour/);
  assert.match(layout, /<SupportVoicePopover \/>/);
  assert.match(layout, /aria-label="Start dashboard tour"/);
  assert.match(layout, /min-h-0 flex-1 py-4/);
  assert.match(support, /placement = "sidebar"/);
});

test("shell title ownership does not duplicate existing dashboard page headings", () => {
  assert.match(layout, /title === "Overview"/);
  assert.match(layout, /<span className="sr-only">\{title\}<\/span>/);
});

test("period and sidebar controls retain truthful behavior", () => {
  assert.match(overview, /const periodRows = useMemo/);
  assert.match(overview, /value: String\(stats\.roles\)/);
  assert.match(overview, /value: String\(stats\.candidates\)/);
  assert.doesNotMatch(overview, /ChevronDown/);
  assert.match(layout, /hover:bg-red-500\/15/);
});

test("overview uses live role and dashboard row endpoints for every panel", () => {
  assert.match(overview, /fetch\(`\$\{backendBase\}\/roles/);
  assert.match(overview, /fetch\(`\$\{backendBase\}\/dashboard\/rows/);
  assert.match(overview, /metricDefinitions/);
  assert.match(overview, /roleHealth/);
  assert.match(overview, /activityData/);
  assert.match(overview, /sortedRows\.slice\(0, 3\)/);
  assert.doesNotMatch(overview, /Morgan Miller|Alex Carter|Northstar Dental Group/);
});

test("option three overview retains the approved information hierarchy", () => {
  for (const label of [
    "Today&apos;s decisions",
    "Your action queue",
    "Role health",
    "Interview activity",
    "Recent movement",
    "Automations running",
  ]) {
    assert.match(overview, new RegExp(label));
  }
  assert.match(overview, /ResponsiveContainer/);
  assert.match(overview, /StatusBadge/);
});
