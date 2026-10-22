import { motion } from "framer-motion";

export default function PrivacyPage() {
  return (
    <div className="b1-legal-page min-h-screen bg-[#F8F9FD]">
      <div className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero-bg" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 1, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#0A1547]/10 text-sm font-medium text-[#0A1547]/60 mb-5 shadow-sm">
              Privacy
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0A1547] leading-tight mb-3">
              Privacy Policy
            </h1>
            <p className="text-base text-[#0A1547]/50">Effective Date: 10/21/2026</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 1, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 lg:p-12 prose prose-sm max-w-none"
          style={{ color: "#0A1547" }}
        >
          <p className="text-[#0A1547]/70 leading-relaxed mb-8">
            This Privacy Policy explains how alphaSource Network LLC, operating as alphaSource AI, collects and uses limited information through the public website, alphaScreen, and related product workflows. It focuses on public website analytics, contact and demo form behavior, and high-level product data practices.
          </p>

          <Section number="1" title="OVERVIEW">
            <p>
              alphaSource AI collects limited information to operate the public website, respond to inquiries, understand interest in alphaScreen, support product workflows, and improve our services. The information collected depends on how a visitor or customer interacts with the website or product.
            </p>
            <p>
              Public website activity is separate from authenticated dashboard, client, candidate, and account activity. Product and account data is handled according to applicable agreements, product controls, and customer configuration.
            </p>
          </Section>

          <Section number="2" title="PUBLIC WEBSITE ANALYTICS">
            <p>
              If you enable Analytics in Privacy choices, we collect public page view information for pages such as the home page, alphaScreen page, about page, support and FAQ pages, terms and privacy pages, and other public landing pages. This may include page path, timestamp, referrer or source, campaign parameters, CTA interactions, device and browser-level technical information, and similar site-performance signals.
            </p>
            <p>
              We use first-party public analytics to understand site performance, improve product messaging, measure interest, troubleshoot abuse or spam, and prepare self-serve purchasing workflows.
            </p>
            <p>
              On selected production marketing pages, enabling Analytics also permits Google Analytics 4 to measure public page views and limited navigation and form events. Google receives technical browser and device information and may use analytics cookies. We send fixed public page titles and paths and limited event categories, not lead names, email addresses, phone numbers, message contents, account identifiers, URL query values or private workflow contents. Advertising personalization, Google signals and automatic form tracking are disabled for this integration. Learn <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">how Google uses information from sites that use its services</a>.
            </p>
            <p>
              Analytics events should not include names, email addresses, phone numbers, freeform message text, passwords, candidate interview responses, dashboard content, or private customer account data.
            </p>
          </Section>

          <Section number="3" title="CTA AND EVENT TRACKING">
            <p>
              When Analytics is enabled, public call-to-action interactions may be tracked, including demo requests, contact links, signup or self-serve interest, navigation links, footer links, and hero calls to action. We use this information to understand visitor interest and improve the public website experience.
            </p>
          </Section>

          <Section number="4" title="LEAD DRAFT AND ABANDONED FORM CAPTURE">
            <p>
              If a visitor begins completing a public contact, demo, or inquiry form and enters usable business contact information, alphaSource AI may save a partial business-contact lead record even if the visitor does not complete the form.
            </p>
            <p>
              Message or freeform inquiry text is saved only when the visitor intentionally submits the form. Partial lead draft capture is used for business follow-up, assisting with inquiries, spam prevention, and service improvement.
            </p>
            <p>
              Visitors may ask us to delete their business contact information or ask not to be contacted.
            </p>
          </Section>

          <Section number="5" title="COOKIES AND SIMILAR TECHNOLOGIES">
            <p>
              Optional technologies are blocked until you enable the relevant category in Privacy choices. Analytics enables first-party public-site event measurement and Google Analytics 4 on selected production marketing pages. The Google integration excludes pricing and signup, ROI, support, sign-in and password setup, agreements, payments, dashboards and candidate or interview workflows. Marketing attribution enables Identity Pixel when configured to understand where traffic originates and how visitors navigate through the public website.
            </p>
            <p>
              We store your category preferences using the first-party preference key <code>alphasource:tracking-preferences:v2</code>. Each optional technology remains blocked until its category is enabled. Turning off Analytics clears application-owned optional analytics identifiers where feasible. Changing a preference stops future application-controlled loading; cookies or storage already set by a third party may not be directly removable by this site.
            </p>
            <p>
              Turning off Analytics disables further Google measurement in the current document. When the preference is saved successfully, the page reloads to unload the Google tag. If browser storage is unavailable, the integration fails closed rather than loading Google Analytics without a saved choice. Previously collected data is not erased by changing this device preference; you can contact us about privacy requests.
            </p>
            <p>
              You can reopen Privacy choices from the footer to change your preferences. alphaScreen candidate interview, admin, and client workflow access do not require public marketing pixels to function. Essential sign-in, security, and core website functions remain active regardless of optional technology preferences.
            </p>
            <p>
              Session replay is a separate choice, off by default. If you explicitly enable it and the feature is enabled for production, Microsoft Clarity may receive masked public-page layouts, clicks, scrolling and technical browser information, including your IP address as part of the connection. Text is strictly masked and forms, entered values, sign-in, pricing, support, account, agreement, payment and candidate workflows are excluded. Google Analytics or marketing permission alone does not permit replay. We do not provide Clarity custom account identifiers or connect this integration to advertising platforms. See <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">Microsoft's Privacy Statement</a>.
            </p>
            <p>
              Replay pauses when you open Privacy choices or interact with a form. Sign-in from a replay-enabled page uses a fresh, unrecorded document and the existing sign-in panel. Saving a replay choice may reload the page. Withdrawing replay permission stops future application-controlled uploads, removes known Clarity identifiers where feasible and reloads without the replay library. Previously delivered data is not retracted. Browser privacy signals and blocked storage are respected; other public site functions do not require replay.
            </p>
          </Section>

          <Section number="6" title="PRODUCT AND ACCOUNT DATA">
            <p>
              Authenticated dashboard, client, candidate, and product workflows may involve information that is different from public website analytics and public lead capture. Supabase authentication and essential application/session technology are used to provide sign-in and product access and are not controlled by public optional tracking choices. Product and account data is handled according to applicable agreements, product controls, access permissions, and operational requirements.
            </p>
            <p>
              This notice is not intended to replace customer agreements, product-specific notices, or security documentation that may apply to a particular alphaScreen deployment.
            </p>
          </Section>

          <Section number="7" title="CANDIDATE DATA">
            <p>
              Candidate, interview, and report data is used to provide screening and hiring workflow services requested by the client or employer. This may include information submitted by the candidate, interview responses, resume materials, transcripts, recordings where used, reports, and related workflow information.
            </p>
            <p>
              Final hiring decisions remain with the employer or hiring team. alphaSource AI does not sell candidate information or use candidate information for unrelated marketing purposes.
            </p>
          </Section>

          <Section number="8" title="MOBILE INFORMATION AND TRANSACTIONAL VERIFICATION MESSAGES">
            <p>
              If you select Text Message for interview-access verification, alphaScreen processes the mobile number and country you provide, the time and version of your selection, a keyed destination fingerprint, delivery and opt-out status, line-type classification, and limited provider delivery metadata.
            </p>
            <p>
              We use this information only to deliver and secure the requested verification flow, prevent abuse and excess spend, honor STOP and related control requests, investigate bounded delivery failures, and maintain compliance evidence.
            </p>
            <p>
              We may disclose the minimum necessary mobile information to contracted messaging, carrier, security, and infrastructure providers that process it for these purposes. We do not sell mobile information or share it with third parties for their own promotional or marketing purposes. Email verification remains available.
            </p>
          </Section>

          <Section number="9" title="SALES AND DEMO TEXT MESSAGES">
            <p>
              If you give clear verbal permission during a recorded sales call, alphaSource Network LLC may send text messages about alphaScreen to the mobile number you confirm. These messages may include information you requested, demo booking links, confirmations or reminders, responses to product questions, and occasional promotional follow-ups. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase.
            </p>
            <p>
              We may retain the recorded call and contact-record details such as the consent date, time, representative, confirmed number, disclosure version, delivery status, and opt-out status to document and honor your choice. Reply STOP to opt out or HELP for help. If permission is declined, unclear, or withdrawn, sales text messages must not be sent.
            </p>
            <p>
              Mobile information and SMS consent records are not sold or shared with third parties for their own marketing purposes. We disclose the minimum necessary information to contracted messaging providers, carriers, hosting providers, and service providers that help deliver messages, maintain records, prevent abuse, and honor opt-outs. Review the exact <a href="/sales-sms-consent/" className="text-[#A380F6] hover:underline">sales SMS verbal consent process</a>.
            </p>
          </Section>

          <Section number="10" title="SERVICE PROVIDERS AND DATA SHARING">
            <p>
              alphaSource AI uses service providers for hosting, analytics infrastructure, email, database and storage, payment, AI and video services, error monitoring, support, security, and related operations. These providers help us operate the website and services.
            </p>
            <p>
              We may share information when needed to provide services, support customers, comply with legal obligations, protect rights and security, or complete normal business operations.
            </p>
          </Section>

          <Section number="11" title="USER CHOICES AND CONTACT">
            <p>
              You may contact us with privacy questions, deletion requests, or requests not to be contacted. The best public contact method is email at{" "}
              <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline">
                info@alphasourceai.com
              </a>
              .
            </p>
            <p>
              We may need enough information to identify the relevant record and verify the request before taking action.
            </p>
          </Section>

          <Section number="12" title="CHANGES TO THIS NOTICE" last>
            <p>
              We may update this Privacy Policy as our website, products, services, and workflows evolve. The effective date above shows when this notice was last updated.
            </p>
          </Section>
        </motion.div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
  last = false,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`b1-legal-section ${last ? "" : "mb-10 pb-10 border-b border-gray-100"}`}>
      <h2 className="text-lg font-black text-[#0A1547] mb-4 flex items-baseline gap-3">
        <span
          className="text-sm font-bold px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ backgroundColor: "#A380F615", color: "#A380F6" }}
        >
          {number}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-[#0A1547]/70 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p]:leading-relaxed">
        {children}
      </div>
    </div>
  );
}
