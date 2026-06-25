import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, ClipboardCheck, ShieldCheck } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import playbookMarkdown from "../../../../../docs/alphascreen-public-purchase-support-playbook.md?raw";

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const mutedPanelStyle = {
  backgroundColor: "color-mix(in srgb, var(--as-text) 4%, transparent)",
  borderColor: "var(--as-border)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };

const SUPPORT_STANDARD =
  "Every purchase row should be triaged from Admin Public Purchases. Do not manually mark agreements, payments, billing, or account activation outside an approved escalation.";

function playbookBodyMarkdown(): string {
  const start = playbookMarkdown.indexOf(
    "## How a public purchase moves through alphaScreen",
  );
  if (start < 0) return playbookMarkdown;
  return playbookMarkdown.slice(start);
}

function parsePlaybookMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let activeList: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!activeList) return;
    blocks.push({
      type: "list",
      ordered: activeList.ordered,
      items: activeList.items,
    });
    activeList = null;
  };

  const flushOpenBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushOpenBlocks();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushOpenBlocks();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(line);
    if (quoteMatch) {
      flushOpenBlocks();
      blocks.push({ type: "quote", text: quoteMatch[1].trim() });
      continue;
    }

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      if (!activeList || !activeList.ordered) {
        flushList();
        activeList = { ordered: true, items: [] };
      }
      activeList.items.push(orderedMatch[1].trim());
      continue;
    }

    const unorderedMatch = /^-\s+(.+)$/.exec(line);
    if (unorderedMatch) {
      flushParagraph();
      if (!activeList || activeList.ordered) {
        flushList();
        activeList = { ordered: false, items: [] };
      }
      activeList.items.push(unorderedMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushOpenBlocks();
  return blocks;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  if (block.type === "heading") {
    const id = slugifyHeading(block.text);
    if (block.level === 2) {
      return (
        <h2
          id={id}
          className="border-t pt-7 text-xl font-black sm:text-2xl"
          style={primaryTextStyle}
        >
          {block.text}
        </h2>
      );
    }
    return (
      <h3
        id={id}
        className="pt-2 text-base font-black"
        style={primaryTextStyle}
      >
        {block.text}
      </h3>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote
        className="rounded-2xl border-l-4 border-[#A380F6] px-4 py-3 text-sm font-semibold leading-relaxed"
        style={mutedPanelStyle}
      >
        {renderInline(block.text)}
      </blockquote>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-6 text-sm font-semibold leading-relaxed`}
        style={mutedTextStyle}
      >
        {block.items.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
  }

  return (
    <p className="text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
      {renderInline(block.text)}
    </p>
  );
}

export default function AdminPublicPurchasePlaybookPage() {
  const blocks = useMemo(
    () => parsePlaybookMarkdown(playbookBodyMarkdown()),
    [],
  );

  return (
    <AdminLayout title="Public Purchase Support Playbook">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p
              className="text-[10px] font-black uppercase tracking-[0.24em]"
              style={subtleTextStyle}
            >
              Admin only
            </p>
            <h1
              className="mt-2 text-2xl font-black sm:text-3xl"
              style={primaryTextStyle}
            >
              alphaScreen Public Purchase Support Playbook
            </h1>
            <p
              className="mt-2 text-sm font-semibold leading-relaxed"
              style={mutedTextStyle}
            >
              Internal support guide for self-serve alphaScreen membership
              purchases.
            </p>
          </div>
          <Link
            href="/admin/public-purchases"
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition hover:border-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
            style={surfaceCardStyle}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Public Purchases
          </Link>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border p-4" style={surfaceCardStyle}>
            <BookOpen className="h-5 w-5 text-[#A380F6]" aria-hidden="true" />
            <p className="mt-3 text-sm font-black" style={primaryTextStyle}>
              Source of truth
            </p>
            <p
              className="mt-1 text-xs font-semibold leading-relaxed"
              style={mutedTextStyle}
            >
              Use Admin Public Purchases to review agreement, checkout, setup,
              and email state.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={surfaceCardStyle}>
            <ClipboardCheck
              className="h-5 w-5 text-[#02ABE0]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-black" style={primaryTextStyle}>
              Recovery actions
            </p>
            <p
              className="mt-1 text-xs font-semibold leading-relaxed"
              style={mutedTextStyle}
            >
              Resend the correct agreement, checkout, setup, or welcome email
              only when the row allows it.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={surfaceCardStyle}>
            <ShieldCheck
              className="h-5 w-5 text-[#02D99D]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-black" style={primaryTextStyle}>
              Escalation boundary
            </p>
            <p
              className="mt-1 text-xs font-semibold leading-relaxed"
              style={mutedTextStyle}
            >
              Do not manually change agreement, payment, billing, or account
              activation state.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border p-5" style={surfaceCardStyle}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-[#A380F6]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-black" style={primaryTextStyle}>
                Support standard
              </p>
              <p
                className="mt-1 text-sm font-semibold leading-relaxed"
                style={mutedTextStyle}
              >
                {SUPPORT_STANDARD}
              </p>
            </div>
          </div>
        </section>

        <article
          className="mx-auto w-full max-w-5xl rounded-2xl border p-5 sm:p-7"
          style={surfaceCardStyle}
        >
          <div className="space-y-5">
            {blocks.map((block, index) => (
              <MarkdownBlockView key={`${block.type}-${index}`} block={block} />
            ))}
          </div>
        </article>
      </div>
    </AdminLayout>
  );
}
