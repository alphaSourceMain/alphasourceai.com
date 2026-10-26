import copy from "./retail-sales-copy.json";

// ON returns the original version unchanged. OFF projects guidance only, never
// a saved agreement, quote, billing record or financial payload.
export function retailContentForMode<T>(value: T, enabled: boolean): T {
  if (enabled) return value;
  const answers = copy.answers as Record<string, string>;
  function visit(input: unknown): unknown {
    if (typeof input === "string") return copy.replacements.reduce((text, [from, to]) => text.split(from).join(to), input);
    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    const record = input as Record<string, unknown>;
    const output = Object.fromEntries(Object.entries(record).map(([key, val]) => [key, visit(val)]));
    if (typeof record.question === "string" && answers[record.question]) output.answer = answers[record.question];
    if (typeof record.name === "string" && answers[record.name] && record.acceptedAnswer)
      output.acceptedAnswer = { ...(record.acceptedAnswer as object), text: answers[record.name] };
    // Runtime SEO uses its own verified marketing mode, not old 3/6-month offers.
    if (Array.isArray(record.offers)) output.offers = record.offers.filter(o => !/\b[36]-month\b/.test(String(o?.name)));
    return output;
  }
  return visit(value) as T;
}

// Static CDN HTML cannot read a runtime admin toggle. Keep commercial fallback
// neutral; hydrated React publishes the selected version and structured data.
export function neutralRetailContent<T>(value: T): T {
  const neutral = "For current membership pricing, payment options, and availability, review the pricing page or contact sales. Existing accepted agreements remain authoritative.";
  function visit(input: unknown): unknown {
    if (typeof input === "string") return /\$[\d,]|3-,|3\/6\/12|3, 6, or 12/.test(input) ? neutral : input;
    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(Object.entries(input).filter(([key]) => key !== "offers").map(([key, val]) => [key, visit(val)]));
  }
  return visit(value) as T;
}

export function withoutOfferMetadata<T>(value: T): T {
  function visit(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(visit);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(Object.entries(input).filter(([key]) => key !== "offers").map(([key, val]) => [key, visit(val)]));
  }
  return visit(value) as T;
}
