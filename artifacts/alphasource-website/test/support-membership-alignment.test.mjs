import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import test from "node:test";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
const compiled = await build({
  stdin: { contents: `export * from './src/content/supportGuidance.ts';
    export * from './src/content/dashboardSupportContent.ts';
    export * from './src/lib/publicContent.ts';`,
    resolveDir: root.pathname, loader: "ts" },
  alias: { "@": new URL("src", root).pathname },
  bundle: true, write: false, platform: "node", format: "esm",
});
const content = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const find = (sections, question) => sections.flatMap(s => s.items).find(q => q.question === question)?.answer;

test("public and client FAQ reuse every current membership answer without duplicates", () => {
  for (const item of content.membershipFaqs) {
    assert.equal(find(content.faqSections, item.question), item.answer);
    assert.equal(find(content.publicFaqSections, item.question), item.answer);
    assert.equal(content.publicSupportQuestions.find(q => q.question === item.question)?.answer, item.answer);
  }
  for (const sections of [content.faqSections, content.publicFaqSections]) {
    const questions = sections.flatMap(s => s.items.map(q => q.question));
    assert.equal(new Set(questions).size, questions.length);
  }
  assert.match(read("src/App.tsx"), /path="\/dashboard\/support"\s+component={DashboardFaqPage}/);
  assert.match(read("src/App.tsx"), /path="\/dashboard\/faq"\s+component={DashboardFaqPage}/);
});

test("prices, commitments and included capacity match the new catalog, not legacy defaults", () => {
  const pricing = content.membershipPricingFaq.answer;
  for (const price of ["$1,200", "$1,950", "$3,300", "$2,100", "$3,600", "$6,500"]) assert.ok(pricing.includes(price));
  assert.doesNotMatch(pricing, /\$399|\$699/);
  assert.match(content.membershipRoleFeesFaq.answer, /\$399.*\$699/);
  assert.match(pricing, /USD, before applicable tax/);
  assert.match(pricing, /not the prepaid price divided into monthly payments/);
  assert.match(content.membershipTermFaq.answer, /3-, 6-, or 12-month commitment/);
  assert.match(content.membershipTermFaq.answer, /current-term payments remain owed/);
  assert.match(content.membershipCapacityFaq.answer, /20 interviews, a 10-minute cap, and 5 scored questions/);
  assert.match(content.membershipCapacityFaq.answer, /30 interviews, a 12-minute cap, and 6 scored questions/);
  assert.match(content.membershipCapacityFaq.answer, /\$25 each/);
  assert.match(content.membershipCapacityFaq.answer, /\$30 each/);
  assert.match(content.firstRolePrepayAnswer, /\$359 for Essential or \$629 for Pro/);
  assert.match(content.firstRolePrepayAnswer, /no expiration/);
  assert.match(content.firstRolePrepayAnswer, /does not renew/);
});

test("dates, renewal, refund and Enterprise notice distinctions preserve accepted terms", () => {
  assert.match(content.membershipDatesFaq.answer, /agreement-generation date/);
  assert.match(content.membershipDatesFaq.answer, /Payment must succeed/);
  assert.match(content.membershipDatesFaq.answer, /does not move those agreed dates/);
  assert.match(content.membershipDatesFaq.answer, /Stripe's actual payment and renewal schedule/);
  const renewal = content.membershipRenewalFaq.answer;
  for (const phrase of ["same accepted platform price and term", "before the displayed renewal date", "not refunding the current term or removing owed installments", "paid term", "refund policy", "notice cutoff", "not the date access or payment obligations end"]) assert.ok(renewal.includes(phrase));
  assert.match(content.membershipTermFaq.answer, /Existing and custom accounts keep their accepted agreement terms/);
});

test("Enterprise usage, pool, rollover and support guidance avoids misleading promises", () => {
  assert.match(content.enterpriseBillingFaq.answer, /per-completed-interview rate/);
  assert.match(content.enterpriseBillingFaq.answer, /Pools are not unlimited interviews/);
  assert.match(content.enterpriseBillingFaq.answer, /preview is not an invoice or proof of payment/);
  assert.match(content.enterpriseBillingFaq.answer, /Do not buy per-role top-ups for a usage-based account/);
  assert.match(content.rolloverFaq.answer, /same client or entity/);
  assert.match(content.rolloverFaq.answer, /90 days after role closure/);
  assert.match(content.membershipSupportFaq.answer, /Pro includes live support chat and email/);
  assert.match(content.membershipSupportFaq.answer, /Essential includes the Help Center and email/);
  assert.match(content.membershipSupportFaq.answer, /not a live human conversation/);
  const active = JSON.stringify([content.faqSections, content.publicFaqSections, content.publicSupportQuestions]);
  assert.doesNotMatch(active, /\$299 monthly|\$599 monthly|\$3,299|\$6,499|installment option for a 12-month|another 12 months unless written|Enterprise interviews are 15 minutes|Enterprise includes 7\./);
});

test("generated knowledge preserves every current answer and full dated release history", () => {
  const bytes = read("src/content/support-voice-knowledge.json");
  const k = JSON.parse(bytes);
  assert.deepEqual(k.dashboard.faq_sections, content.faqSections);
  assert.deepEqual(k.public.support_topics, content.publicSupportTopics);
  const all = [...k.dashboard.faq_sections.flatMap(s => s.items), ...k.public.faq_sections.flatMap(s => s.items), ...k.public.support_questions];
  const keys = all.map(q => JSON.stringify([q.question, q.answer]));
  assert.equal(new Set(keys).size, keys.length);
  for (const item of [...content.faqSections.flatMap(s => s.items), ...content.publicFaqSections.flatMap(s => s.items), ...content.publicSupportQuestions]) {
    assert.ok(keys.includes(JSON.stringify([item.question, item.answer])), `Missing knowledge: ${item.question}`);
  }
  assert.deepEqual(k.dashboard.product_updates, content.productUpdates);
  assert.deepEqual(k.public.product_updates, content.publicProductUpdates);
  assert.ok(content.productUpdates.length > 1 && content.publicProductUpdates.length > 1);
  assert.equal(k.knowledge_version, content.DASHBOARD_SUPPORT_KNOWLEDGE_VERSION);
  assert.equal(k.public_content_last_updated, content.PUBLIC_CONTENT_LAST_UPDATED);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), read("src/content/support-voice-knowledge.sha256").trim());
});
