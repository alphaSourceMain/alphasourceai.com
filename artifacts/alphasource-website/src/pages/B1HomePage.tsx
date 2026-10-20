import { useEffect, useRef, useState, type MouseEvent } from "react";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { useTrackingConsent } from "@/context/TrackingConsentContext";
import "./b1-home.css";

const navigation = [
  ["About", "#about"],
  ["alphaScreen", "#screen"],
  ["How it works", "#how"],
  ["FAQ", "/faq"],
];
const explore = [
  ["Home", "/"],
  ["About us", "#about"],
  ["alphaScreen", "#screen"],
  ["Pricing", "/alphascreen/pricing"],
  ["FAQ", "/faq"],
  ["Support", "/support"],
];
const product = [
  ["How it works", "#how"],
  ["Security", "/alphascreen/security"],
  ["Candidate experience", "/alphascreen/candidate-experience"],
  ["Dental groups", "/alphascreen/for-dental-groups"],
  ["ROI estimator", "/alphascreen/roi"],
];

export default function B1HomePage() {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pendingDestination = useRef<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { openTrackingPreferences } = useTrackingConsent();
  const [setupDismissed, setSetupDismissed] = useState(false);
  const setupComplete =
    !setupDismissed &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("setup") === "complete";

  useEffect(() => {
    // Match the reference's native anchors, restoring other routes' preference on exit.
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    if (!setupComplete) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSetupDismissed(true);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [setupComplete]);

  useEffect(() => {
    const elements = root.current?.querySelectorAll<HTMLElement>(".r");
    if (!elements) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      elements.forEach((element) => element.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.1 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      // React runs the previous menu effect's cleanup before this closed effect.
      // Only then is the destination no longer inert and safe to focus.
      const destination = pendingDestination.current;
      pendingDestination.current = null;
      if (!destination) return;
      const frame = window.requestAnimationFrame(() =>
        document.getElementById(destination)?.focus({ preventScroll: true }),
      );
      return () => window.cancelAnimationFrame(frame);
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        ".hero, section, .cta, footer",
      ) || [],
    ).map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => {
      element.inert = true;
    });
    const focusFrame = window.requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLAnchorElement>("a")?.focus(),
    );
    const close = () => {
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab") return;
      const focusable = [
        menuButton.current,
        ...Array.from(
          panel.current?.querySelectorAll<HTMLAnchorElement>("a") || [],
        ),
      ].filter(Boolean) as HTMLElement[];
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth > 900) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  const closeMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    const href = event.currentTarget.getAttribute("href");
    pendingDestination.current = href?.startsWith("#") ? href.slice(1) : null;
    setMenuOpen(false);
  };
  return (
    <div className="b1-home" ref={root}>
      {setupComplete && (
        <p className="setup-notice" role="status">
          Your password is set.{" "}
          <a href="/support?signin=client">
            Sign in to access your alphaScreen dashboard.
          </a>{" "}
          <button
            type="button"
            onClick={() => setSetupDismissed(true)}
            aria-label="Dismiss password setup status"
          >
            Dismiss
          </button>
        </p>
      )}
      <div className="b1-dark">
        <nav
          aria-label="Main navigation"
          className={menuOpen ? "menu-open" : undefined}
        >
          <div className="wrap">
            <a href="/" aria-label="alphaSource AI home">
              <img
                src="/brand/b1/logo-light.png"
                alt="alphaSource AI"
                width="466"
                height="120"
                style={{ width: "auto" }}
              />
            </a>
            <div className="pillnav">
              {navigation.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  data-analytics-cta={label}
                  data-analytics-placement="primary-nav"
                >
                  {label}
                </a>
              ))}
            </div>
            <div className="navr">
              <a
                className="btn btn-o"
                href="#contact"
                data-analytics-cta="Get in Touch"
                data-analytics-placement="primary-nav"
              >
                Get in touch
              </a>
              <button
                ref={menuButton}
                type="button"
                className="menu-btn"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="b1-mobile-panel"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span />
                <span />
              </button>
            </div>
          </div>
        </nav>
        <div
          ref={panel}
          className={`mpanel${menuOpen ? " open" : ""}`}
          id="b1-mobile-panel"
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
        >
          {navigation.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={closeMenu}
              data-analytics-cta={label}
              data-analytics-placement="mobile-nav"
            >
              {label}
            </a>
          ))}
          <a className="btn btn-g" href="#contact" onClick={closeMenu}>
            Get in touch →
          </a>
        </div>
        <header className="hero wrap">
          <div className="glow" />
          <img className="mark" src="/brand/b1/alpha.png" alt="" />
          <span className="chip">
            <i />
            AI-powered solutions
          </span>
          <h1>
            Unleash your <span className="gt">talent.</span>
          </h1>
          <p>
            Custom AI tools that give your team hours back. We don't replace
            judgment. We enhance it.
          </p>
          <div className="ctas">
            <a
              className="btn btn-g"
              href="#contact"
              data-testid="hero-cta-primary"
              data-analytics-cta="Get in Touch"
              data-analytics-placement="home-hero"
            >
              Get in touch →
            </a>
            <a
              className="btn btn-o"
              href="#screen"
              data-testid="hero-cta-secondary"
              data-analytics-cta="Explore alphaScreen"
              data-analytics-placement="home-hero"
            >
              Explore alphaScreen
            </a>
          </div>
          <div className="stats">
            <div>
              <b>Reclaim your time</b>
              <span>Hours back for higher-value work</span>
            </div>
            <div>
              <b>Consistent support</b>
              <span>Repeatable workflows and clearer handoffs</span>
            </div>
            <div>
              <b>Clearer insight</b>
              <span>Organized signal for better decisions</span>
            </div>
          </div>
        </header>
      </div>
      <main id="home-content">
        <section id="about" tabIndex={-1}>
          <div className="wrap">
            <div className="intro r">
              <div>
                <div className="kick">People-driven</div>
                <h2>Obsessed with people. Powered by AI.</h2>
              </div>
              <p>
                Every company has work that eats time, hides insight, or slows
                good people down. From automated candidate screening to
                operational analysis and custom AI workflows, alphaSource
                creates technology that fits your team, your process, and your
                goals.
              </p>
            </div>
            <div className="bento">
              <div className="card c1 r">
                <div className="ico">01</div>
                <h3>Custom AI solutions</h3>
                <p>
                  Practical tools built around the workflows your team already
                  runs.
                </p>
              </div>
              <div className="card c2 r">
                <div className="ico">02</div>
                <h3>alphaScreen</h3>
                <p>
                  Structured AI interview support for teams that need clearer
                  candidate signal.
                </p>
              </div>
              <div className="card c3 r">
                <div className="ico">03</div>
                <h3>AI-powered analysis</h3>
                <p>
                  Turn documents, conversations, and operating data into usable
                  insight.
                </p>
              </div>
              <div className="card c4 r">
                <div className="ico">04</div>
                <h3>Consulting + implementation</h3>
                <p>
                  Hands-on help connecting AI to the way your business actually
                  works.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="screen" tabIndex={-1} style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="screen r">
              <div>
                <span className="badge">
                  Featured solution · Patent pending
                </span>
                <h2 style={{ color: "#fff" }}>
                  Meet <span className="gt">alphaScreen</span>
                </h2>
                <p>
                  Our AI-powered interview and candidate evaluation product for
                  teams that need a clearer, more consistent screening process.
                </p>
                <div className="feat">
                  <div>
                    <b>A clearer picture</b>
                    <span>
                      See more candidates clearly and spend your time on what
                      you do best.
                    </span>
                  </div>
                  <div>
                    <b>Part of a broader suite</b>
                    <span>
                      One part of the AI tools and consulting we build for
                      leaders who want their hours back.
                    </span>
                  </div>
                  <div>
                    <b>More time for what matters</b>
                    <span>Less time on the grind.</span>
                  </div>
                </div>
                <a
                  className="btn btn-g"
                  href="/alphascreen"
                  data-analytics-cta="See alphaScreen"
                  data-analytics-placement="home-feature"
                >
                  See alphaScreen →
                </a>
              </div>
              <div className="term" aria-label="Illustrative workflow">
                <div className="d">
                  <i />
                  <i />
                  <i />
                  <span className="lbl">Illustrative</span>
                </div>
                &gt; Loading candidate profile...
                <br />
                &gt; Analyzing interview responses...
                <br />
                &gt; Cross-referencing resume data...
                <br />
                &gt; Organizing next-step insight.
                <br />
                <span style={{ color: "#fff" }}>
                  Ready for your team to review.
                </span>
              </div>
            </div>
          </div>
        </section>
        <section id="how" tabIndex={-1} style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="kick r">How it works</div>
            <h2 className="r" style={{ maxWidth: "20ch" }}>
              From manual work to usable insight, without the grind.
            </h2>
            <div className="steps">
              {[
                [
                  "Map the workflow",
                  "Identify the repeated work, decision points, and context your team relies on.",
                ],
                [
                  "Build the AI tool",
                  "Create a practical workflow, agent, or analysis layer around your actual process.",
                ],
                [
                  "Organize the signal",
                  "Turn scattered information into clear summaries, patterns, and next-step support.",
                ],
                [
                  "Your team decides",
                  "Keep people in control while AI handles the repetitive lift.",
                ],
              ].map(([title, copy], index) => (
                <div className="step r" key={title}>
                  <div className="n">{index + 1}</div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section style={{ paddingTop: 0 }}>
          <div className="wrap about">
            <blockquote className="r">
              "We're obsessed with people. Their grit, their gifts, what they're
              capable of when nobody's wasting their time."
            </blockquote>
            <div className="r">
              <div className="kick">About us</div>
              <p>
                Founded by hands-on leaders with decades in operations,
                alphaSource was born from a shared frustration with wasted time.
                We build AI tools and deliver consulting that give leaders their
                hours back.
              </p>
              <p>
                <b style={{ color: "var(--ink)" }}>Your talent. Our tech.</b>{" "}
                Practical AI built around the real work your team does and the
                decisions people still need to make.
              </p>
            </div>
          </div>
        </section>
        <div className="b1-dark cta" id="contact" tabIndex={-1}>
          <div
            className="glow"
            style={{ left: -200, right: "auto", top: -100 }}
          />
          <div className="wrap">
            <div className="r">
              <div className="kick">Request a demo</div>
              <h2 style={{ color: "#fff" }}>
                Want to see what AI could take off your plate?
              </h2>
              <p>
                Tell us where work is slowing your team down. We'll help
                identify the practical AI workflow or product that fits.
              </p>
              <ul>
                <li>Talk through your current workflow</li>
                <li>Explore custom AI tools and implementation support</li>
                <li>See alphaScreen if hiring is your priority</li>
              </ul>
              <p style={{ fontSize: 14 }}>No commitment required.</p>
            </div>
            <div className="r b1-form-wrap">
              <LeadCaptureForm
                variant="b1"
                formId="home-contact"
                formType="contact"
                formTestId="contact-form"
                productInterest="general-ai-workflows"
                successTitle="Thanks! We'll be in touch."
                successBody="Our team will reach out to schedule a demo with you."
              />
            </div>
          </div>
        </div>
      </main>
      <footer>
        <div className="wrap">
          <div className="fg">
            <div>
              <img
                src="/brand/b1/logo-light.png"
                alt="alphaSource AI"
                style={{ height: 26 }}
              />
              <p style={{ marginTop: 16, maxWidth: "34ch" }}>
                Agentic AI that enhances human judgment, helping teams reclaim
                time and spot potential in every talent interaction.
              </p>
            </div>
            <div>
              <h3>Explore</h3>
              {explore.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  data-analytics-cta={label}
                  data-analytics-placement="footer"
                >
                  {label}
                </a>
              ))}
            </div>
            <div>
              <h3>Product</h3>
              {product.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  data-analytics-cta={label}
                  data-analytics-placement="footer"
                >
                  {label}
                </a>
              ))}
            </div>
            <div>
              <h3>Contact</h3>
              <a href="mailto:info@alphasourceai.com">info@alphasourceai.com</a>
              <a href="tel:+16055998008">
                AI customer support · (605) 599-8008
              </a>
              <a
                href="#contact"
                style={{ color: "var(--mint)" }}
                data-analytics-cta="Request a Demo"
                data-analytics-placement="footer-contact"
              >
                Request a demo →
              </a>
            </div>
          </div>
          <div className="legal">
            <span>
              © {new Date().getFullYear()} alphaSource AI. All rights reserved.
            </span>
            <span>
              <a href="/privacy/">Privacy policy</a>
              <a href="/terms/">Terms &amp; conditions</a>
              <a href="/sales-sms-consent/">SMS consent</a>
            </span>
          </div>
          <div className="access-links">
            <a href="/support?signin=client">Client sign in</a>
            <a href="/support?signin=admin">Admin sign in</a>
            <button type="button" onClick={openTrackingPreferences}>
              Privacy choices
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
