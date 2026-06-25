export const PUBLIC_CONTENT_LAST_UPDATED = "June 25, 2026";

export type PublicFaqItem = {
  question: string;
  answer: string;
};

export type PublicFaqSection = {
  title: string;
  intro: string;
  items: PublicFaqItem[];
};

export const publicFaqSections: PublicFaqSection[] = [
  {
    title: "Hiring Teams",
    intro: "Plain-language answers for employers evaluating alphaScreen for candidate screening.",
    items: [
      {
        question: "What is alphaScreen?",
        answer:
          "alphaScreen is alphaSource AI's web-based candidate screening platform. It helps hiring teams create roles, invite candidates, run structured AI-assisted screening interviews, and review candidate reports before deciding what to do next.",
      },
      {
        question: "How does alphaScreen evaluate candidates?",
        answer:
          "alphaScreen combines role criteria, resume information, structured interview responses, and available interview signals into organized reports and scores. The output is designed to help hiring teams review candidates more consistently, not to make final hiring decisions automatically.",
      },
      {
        question: "Does alphaScreen replace human hiring decisions?",
        answer:
          "No. alphaScreen supports screening and review, but the employer remains responsible for hiring decisions, candidate follow-up, accommodations, and final judgment.",
      },
      {
        question: "Can hiring teams review candidates before taking action?",
        answer:
          "Yes. Authorized hiring team members can review candidate summaries, reports, and available interview information before deciding whether to advance, pause, or reject a candidate.",
      },
    ],
  },
  {
    title: "Candidate Experience",
    intro: "How the screening workflow works from the candidate side.",
    items: [
      {
        question: "What types of interviews does alphaScreen support?",
        answer:
          "alphaScreen supports structured AI avatar screening interviews tied to a specific role. Candidates can complete the screening interview from a web link on their own schedule, subject to the employer's role setup and instructions.",
      },
      {
        question: "Why use alphaScreen instead of only resumes or phone screens?",
        answer:
          "Resumes and phone screens can be inconsistent and time-consuming. alphaScreen gives every candidate a more structured first-pass experience and gives hiring teams a clearer, comparable review record before they spend time on later-stage conversations.",
      },
      {
        question: "How are candidate recordings and reports handled?",
        answer:
          "Candidate interview materials and reports are handled inside the alphaScreen workflow for authorized review. Availability depends on the role, account settings, and the information collected during the screening process.",
      },
    ],
  },
  {
    title: "Security & Data",
    intro: "How alphaSource frames privacy, access, and responsible use.",
    items: [
      {
        question: "How does alphaSource protect candidate data?",
        answer:
          "alphaSource designs alphaScreen around role-based access, privacy-conscious workflows, and limited use of candidate information for screening and account support. Specific privacy details are described in the public Privacy Policy and product terms.",
      },
      {
        question: "Who can access candidate reports?",
        answer:
          "Candidate reports are intended for authorized users within the employer account or approved alphaSource support workflows. Access should be limited to people who need the information for the hiring process.",
      },
      {
        question: "Does alphaScreen make compliance claims?",
        answer:
          "alphaScreen is built to support consistent review and human oversight, but alphaSource does not claim a certification, legal outcome, or compliance status unless that claim is stated in a signed agreement or published policy.",
      },
    ],
  },
  {
    title: "Memberships & Billing",
    intro: "How public alphaScreen membership pricing works.",
    items: [
      {
        question: "How do memberships and role pricing work?",
        answer:
          "Public Basic and Pro memberships include a platform membership fee plus a per-role fee. Basic is listed at $299 monthly or $3,299 annually plus $399 per role. Pro is listed at $599 monthly or $6,499 annually plus $699 per role.",
      },
      {
        question: "What is included in Basic and Pro memberships?",
        answer:
          "Basic includes 20 interviews per role with a 10-minute interview cap. Pro includes 30 interviews per role with a 12-minute interview cap. Additional interviews are listed publicly at $30 for Basic and $35 for Pro.",
      },
      {
        question: "What happens after a company signs up?",
        answer:
          "A company starts membership signup, reviews and signs the membership agreement, completes secure checkout, and then finishes account setup before creating roles and inviting candidates.",
      },
      {
        question: "What if our team needs custom volume or rollout support?",
        answer:
          "Teams with larger volume, custom terms, or implementation needs can request a demo or contact alphaSource about Enterprise options.",
      },
    ],
  },
  {
    title: "Automation & Workflow",
    intro: "How alphaScreen uses structured automation while keeping people in control.",
    items: [
      {
        question: "How does structured interview scoring work?",
        answer:
          "alphaScreen uses role-specific criteria and structured interview responses to organize scoring and report information. The scoring is a review aid for hiring teams, not an automatic employment decision.",
      },
      {
        question: "How does alphaScreen keep humans in control?",
        answer:
          "alphaScreen is designed so people configure roles, review candidate information, decide next steps, and manage communication. AI assists with structure, consistency, and summarization.",
      },
      {
        question: "Can alphaSource help with custom AI workflows beyond hiring?",
        answer:
          "Yes. alphaSource also works with companies on practical AI workflows for operations, analysis, reporting, and business process support when a custom solution is a better fit.",
      },
    ],
  },
];

export const publicFaqItems: PublicFaqItem[] = publicFaqSections.flatMap((section) => section.items);
