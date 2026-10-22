// Shared answers keep public help, client help, and generated AI knowledge aligned.
import { MEMBERSHIP_SUPPORT_FACTS, supportDollars as dollars } from "./membershipSupportFacts.ts";
const { essential, pro, months } = MEMBERSHIP_SUPPORT_FACTS;
export const capacityFaq = {
  question: "Does an unsuccessful interview use our interview capacity?",
  answer: "An attempt explicitly identified as having no substantive candidate response does not consume the role's interview capacity. This includes warm-up-only attempts identified that way. An interrupted interview with substantive responses may still count. An unavailable score alone does not establish a capacity credit; contact support if the usage looks incorrect.",
};

export const membershipTermFaq = {
  question: "Is monthly billing a month-to-month membership?",
  answer: "No. New Essential and Pro memberships have a 3-, 6-, or 12-month commitment. Online signup is prepaid; contact sales for monthly installments over the same selected term. Installments are not a month-to-month cancellation option: current-term payments remain owed. Enterprise terms are customized. Existing and custom accounts keep their accepted agreement terms.",
};

export const firstRolePrepayAnswer = `New self-serve buyers may optionally prepay the first role once: ${dollars(essential.firstRoleCents)} for Essential or ${dollars(pro.firstRoleCents)} for Pro (USD). This non-refundable credit has no expiration and applies to the first paid role opened by the parent or a child entity under the same billing account. It does not renew. Later roles use the standard role fee. Contact support before opening another paid role if the credit is missing, or before changing membership with an unused credit.`;

export const membershipPricingFaq = {
  question: "How does pricing work?",
  answer: `New Essential prepaid platform memberships cost ${essential.prepaidCents.map((price, i) => `${dollars(price)} for ${months[i]} months`).join(", ")}. Pro costs ${pro.prepaidCents.map((price, i) => `${dollars(price)} for ${months[i]} months`).join(", ")}. Prices are USD, before applicable tax; role fees are separate. Contact sales for monthly installments over the selected term; these are not the prepaid price divided into monthly payments. Your accepted agreement controls existing or custom pricing.`,
};

export const membershipRoleFeesFaq = {
  question: "How do billing and role fees work?",
  answer: `Essential role fees are ${dollars(essential.roleCents)} and Pro role fees are ${dollars(pro.roleCents)} (USD), separate from platform fees. For per-role memberships, role fees apply when paid roles are opened; supported per-role top-ups add interview capacity. Usage-based Enterprise instead follows its accepted platform fee, per-completed-interview rate, and any paid pool. Your accepted agreement controls.`,
};

export const membershipCapacityFaq = {
  question: "What is included in a membership?",
  answer: `New Essential roles include ${essential.interviews} interviews, a ${essential.minutes}-minute cap, and ${essential.questions} scored questions; additional interviews cost ${dollars(essential.extraCents)} each. Pro roles include ${pro.interviews} interviews, a ${pro.minutes}-minute cap, and ${pro.questions} scored questions; additional interviews cost ${dollars(pro.extraCents)} each. Platform fees, role fees, and extra interview capacity are separate. Enterprise capacity, duration, question count, and rates are customized in the accepted agreement. Prices are USD; existing signed terms continue to apply.`,
};

export const membershipDatesFaq = {
  question: "When does my membership term start?",
  answer: "New agreements show actual start and end dates before signing. The agreement-generation date fixes the new retail term's start; the end is 3, 6, or 12 months later. Payment must succeed for the agreement to take effect and access to activate; it does not move those agreed dates. Enterprise uses its agreed service dates. Check Billing for Stripe's actual payment and renewal schedule, which can differ from the legal service dates. Existing accepted agreements retain their own terms.",
};

export const membershipRenewalFaq = {
  question: "How do renewal, cancellation, and refunds work?",
  answer: "New Essential and Pro memberships auto-renew at the same accepted platform price and term unless renewal is turned off in Billing before the displayed renewal date. Cancelling means stopping the next renewal, not refunding the current term or removing owed installments. Prepaid access continues through the paid term; monthly access remains subject to payment. Refund exceptions follow your accepted agreement, applicable refund policy, and law. Enterprise and legacy agreements may have a notice cutoff: it is the deadline to request non-renewal, not the date access or payment obligations end.",
};

export const enterpriseBillingFaq = {
  question: "How does Enterprise billing work?",
  answer: "Enterprise can use platform-and-role pricing or usage-based membership with a platform fee plus an agreed per-completed-interview rate. A paid interview pool may cover eligible usage before metered charges apply. Pools are not unlimited interviews; their quantity, price, and conditions come from the accepted agreement. Billing shows available pool and usage information to authorized users; a preview is not an invoice or proof of payment. Do not buy per-role top-ups for a usage-based account. Contact support about a discrepancy.",
};

export const rolloverFaq = {
  question: "How do rollover interviews work?",
  answer: `Pro's rollover model converts eligible unused capacity from a closed role into credits for the same client or entity. New Pro credits expire ${pro.rolloverDays} days after role closure, not ${pro.rolloverDays} days after membership renewal. Check the credit balance and expiry in Billing; do not assume credits transfer between entities. Essential does not include rollover. Enterprise rollover, when agreed, follows its configured terms; a prepaid usage pool is separate from closed-role rollover credits.`,
};

export const membershipSupportFaq = {
  question: "What support comes with each membership?",
  answer: "Essential includes the Help Center and email support. Pro includes live support chat and email support. Enterprise includes a dedicated Client Support Agent and support as agreed. Eligible Pro and Enterprise users can also open Talk with Support for browser AI guidance; it is not a live human conversation or an account-management tool. Human support availability follows your agreed arrangements; no immediate response or resolution is guaranteed.",
};

// Shared by public FAQ and both client Help Center routes; accepted legacy terms remain authoritative.
export const membershipFaqs = [membershipTermFaq, membershipPricingFaq, membershipRoleFeesFaq, membershipCapacityFaq,
  membershipDatesFaq, membershipRenewalFaq, enterpriseBillingFaq, rolloverFaq, membershipSupportFaq];

export const membershipUpdates = [{
  date: "October 22, 2026",
  title: "Membership terms and Enterprise options",
  summary: "Help now reflects the new memberships; accepted existing agreements stay unchanged.",
  bullets: [
    "Essential and Pro offer 3-, 6-, and 12-month prepaid terms; contact sales for installments",
    "Billing shows renewal controls; cancelling does not erase current-term obligations",
    "Enterprise supports custom platform-and-role or usage-based pricing and optional paid pools",
    "Pro and Enterprise include eligible dashboard AI support alongside their agreed support channels",
  ],
}];

export const deviceCheckFaq = {
  question: "How should candidates check their camera and microphone?",
  answer: "Before starting, open the device check, allow camera and microphone access, select the intended devices, and test the speakers. Say a short sentence at normal volume until the meter shows Mic ready. For Mic low, move closer or select another microphone and repeat the check. Where supported, Record voice sample lets you record and play back three seconds locally; the sample stays on the device. Use a quiet place and a stable connection.",
};

export const launchRecoveryFaq = {
  question: "What if verification succeeds but the interview will not start?",
  answer: "Interview launch authorization lasts five minutes after verification. If it expires or cannot be used, follow the on-screen return to Verify and request a fresh code. If returned to the information form, review the preserved details and continue. Avoid repeatedly clicking Start or creating another candidate record. If recovery fails, contact support with the role, approximate time, browser, and error text; never share a verification code or private interview link.",
};

export const microphoneRecoveryFaq = {
  question: "What if the interviewer cannot hear the candidate?",
  answer: "If an audio warning appears during the interview, use Try microphone when offered, check microphone permissions and the selected input, then answer again. Follow the on-screen recovery guidance before refreshing the whole page. Refreshing does not guarantee that an interrupted interview can resume. If the interview ends or recovery fails, contact the hiring team or support before attempting a retake.",
};

export const buyerVerificationFaq = {
  question: "How does verification work during membership signup?",
  answer: "Buyer verification happens before the agreement and checkout. Choose Email or, when offered for an eligible U.S. mobile number, optional Text Message with consent. The code expires in 10 minutes. Follow the displayed resend timer: normally 60 seconds for email and 120 seconds for another text. If a text is delayed, Use email instead appears after about 60 seconds. This buyer verification is separate from candidate interview-access verification and client sign-in.",
};

export const scoringFaqs = [
  {
    question: "How is the Interview Score calculated?",
    answer: "Each scorable question is evaluated against the role's requirements, competency, expected evidence, and role-specific rubric. Question rating bands are Weak 0–39, Adequate 40–59, Strong 60–79, and Exceptional 80–100. The Interview Score is the rounded average of scorable question scores. These bands describe answer evidence, not automatic hiring decisions. Review the actual answers and role context alongside the score.",
  },
  {
    question: "How do Resume, Interview, and Overall scores differ?",
    answer: "The Resume Score reflects alignment with the job description, including relevant experience, skills, and education. The Interview Score reflects the recorded answers to scored questions. When both exist, the Overall Candidate Score is their equally weighted, rounded average: 50% resume and 50% interview. If either is unavailable, Overall is unavailable; a dash is not a zero score.",
  },
  {
    question: "Are warm-up, missed questions, and interrupted answers scored?",
    answer: "Warm-up and its response are excluded from scoring and analysis. Questions not fairly elicited because of an interviewer mistake, a skipped question, or a technical interruption are unscored and excluded from the average. A refusal or evasion of a clearly asked question can be scored as weak evidence. An interview with no substantive candidate response receives no Interview Score, rather than zero.",
  },
  {
    question: "What do confidence, risk, and supporting analysis mean?",
    answer: "Confidence means evidence strength supporting the evaluation, not the candidate's personal confidence. Communication, specificity, consistency, and evaluation-condition signals add context; they are not separate components averaged into the Interview Score. AI-aided and integrity risk indicators are review prompts, not proof of misconduct. Non-verbal signals are secondary supporting evidence, not a stand-alone hiring assessment.",
  },
];

export const interviewStatusFaq = {
  question: "What do the interview status labels mean?",
  answer: "Not started: no interview record is available yet; check whether the candidate has begun. No response: no substantive response was identified; review before arranging a retry. Tech issue: a technical failure was recorded; contact support. Processing: the record has no score yet and is in a workflow or processing state; revisit it and contact support if it remains stuck. Incomplete: the record does not establish a scored result or a more specific state; review it with support. Scored: an Interview Score is available for review. These labels describe interview state, not hiring decisions.",
};

export const septemberUpdates = [
  {
    date: "September 3, 2026",
    title: "Role-specific scoring and clearer interview status",
    summary: "Interview evaluation now uses clearer role-specific evidence anchors and distinguishes unavailable scores from scored results.",
    bullets: [
      "Scorable answers are evaluated against each question's role-specific rubric",
      "Warm-up and questions missed through interviewer or technical problems are excluded",
      "Candidate status labels distinguish no response, technical issues, processing, and scored results",
      "Historical scores are not all automatically recalculated; contact support about a specific report",
    ],
  },
  {
    date: "September 3, 2026",
    title: "Interview preparation and recovery",
    summary: "Improved device checks and recovery guidance help candidates prepare and continue through access or microphone issues.",
    bullets: [
      "Clearer Mic ready and Mic low feedback, with optional local voice-sample playback",
      "Try microphone recovery is available when an in-interview audio warning is shown",
      "Expired launch authorization returns candidates to verification or their preserved information form",
    ],
  },
  {
    date: "September 1, 2026",
    title: "More accurate interview-capacity accounting",
    summary: "Attempts explicitly identified as having no substantive candidate response are excluded from role interview usage.",
    bullets: [
      "No-response attempts receive no Interview Score rather than zero",
      "An interrupted interview with substantive responses may still use capacity",
    ],
  },
];
