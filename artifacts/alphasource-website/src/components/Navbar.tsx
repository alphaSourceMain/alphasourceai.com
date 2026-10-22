import { useState, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { Check, KeyRound, LogIn, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PASSKEYS_ENABLED, supabase } from "@/lib/supabaseClient";
import { buildPwResetUrl } from "@/lib/urlConfig";
import PublicSignInPanel from "@/components/PublicSignInPanel";
import AppearanceSelector from "@/components/AppearanceSelector";

export default function Navbar() {
  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [passwordSetupMode, setPasswordSetupMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [passkeyNotice, setPasskeyNotice] = useState("");
  const [setupSpotlightVisible, setSetupSpotlightVisible] = useState(false);
  const [location, setLocation] = useLocation();
  const setupSpotlightDescriptionId = useId();
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  const signInInFlightRef = useRef(false);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const { login, loginWithPasskey, clientLoginLoading, clientLoginError } = useAuth();
  const queryLoginRef = useRef(false);
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const matches = window.location.pathname.replace(/\/+$/, "") === "/support" && params.get("signin") === "client";
    if (!matches) {
      setPasswordSetupMode(false);
      if (queryLoginRef.current) { setMobileOpen(false); setLoginOpen(false); queryLoginRef.current = false; }
      return;
    }
    queryLoginRef.current = true;
    setPasswordSetupMode(params.get("setup") === "password");
    setLoginOpen(true);
  }, [location, search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(document.querySelectorAll<HTMLElement>(".public-site-shell main, .public-site-shell footer, [data-testid=tracking-consent-banner]"))
      .map(element => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });
    const frame = window.requestAnimationFrame(() => mobilePanelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const controls = [mobileButtonRef.current, ...Array.from(mobilePanelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)") || [])]
        .filter((element): element is HTMLElement => !!element && !!element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const onResize = () => { if (window.innerWidth >= 1280) setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => { element.inert = inert; });
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
    setSetupSpotlightVisible(normalizedPath === "/" && params.get("setup") === "complete");
  }, [location]);

  useEffect(() => {
    if (!setupSpotlightVisible || typeof window === "undefined") return undefined;

    const timer = window.setTimeout(() => setSetupSpotlightVisible(false), 3000);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSetupSpotlightVisible(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setupSpotlightVisible]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInInFlightRef.current || clientLoginLoading) return;

    setResetError("");
    setResetSuccess("");
    setPasskeyNotice("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) return;
    if (!isValidEmail(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");

    signInInFlightRef.current = true;
    const { error } = await login(normalizedEmail, password);
    signInInFlightRef.current = false;
    if (error) return;

    setLoginOpen(false);
    setMobileOpen(false);
    const next = new URL(window.location.href).searchParams.get("next");
    setLocation(next || "/dashboard");
  };

  const handlePasskeySignIn = async () => {
    if (signInInFlightRef.current || clientLoginLoading) return;
    setEmailError("");
    setResetError("");
    setResetSuccess("");
    setPasskeyNotice("");
    signInInFlightRef.current = true;
    const { error, cancelled } = await loginWithPasskey();
    signInInFlightRef.current = false;
    if (cancelled) {
      setPasskeyNotice("Passkey sign-in was cancelled. You can try again or use your password.");
      return;
    }
    if (error) return;
    setLoginOpen(false);
    setMobileOpen(false);
    const next = new URL(window.location.href).searchParams.get("next");
    setLocation(next || "/dashboard");
  };

  const startReset = async () => {
    setResetError("");
    setResetSuccess("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setResetError("Enter your email first.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");

    const redirectTo = buildPwResetUrl({ origin: "client" });
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      setResetError(`Could not start reset: ${error.message}`);
      return;
    }
    setResetSuccess("Check your email for a password reset link.");
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about/" },
    { label: "alphaScreen", href: "/alphascreen" },
    { label: "How It Works", href: "/alphascreen/how-it-works" },
    { label: "Pricing", href: "/alphascreen/pricing" },
    { label: "FAQ", href: "/faq" },
    { label: "Support", href: "/support" },
    { label: "Get in touch", href: "/#contact" },
  ];
  const openSignIn = () => { setPasswordSetupMode(false); setSetupSpotlightVisible(false); setMobileOpen(false); setLoginOpen(true); };
  const pageDimOverlay = setupSpotlightVisible && typeof document !== "undefined" ? createPortal(
    <button type="button" aria-label="Dismiss sign-in guidance" className="fixed inset-0 z-40 cursor-default bg-slate-900/35"
      onClick={() => setSetupSpotlightVisible(false)} />, document.body) : null;
  return <>
    {pageDimOverlay}
    <nav className={`b1-nav ${scrolled ? "shadow-lg" : ""}`} aria-label="Main navigation">
      <div className="b1-nav-inner">
        <div className="b1-pillnav">
          {navLinks.map(link => <a key={link.label} href={link.href}
            aria-current={location.replace(/\/$/, "") === link.href.replace(/\/$/, "") ? "page" : undefined}
            data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
            data-analytics-cta={link.label} data-analytics-placement="primary-nav">{link.label}</a>)}
        </div>
        <div className={`b1-nav-actions ${setupSpotlightVisible ? "relative z-50" : ""}`}>
          <AppearanceSelector />
          <button ref={loginButtonRef} type="button" onClick={openSignIn} className="b1-btn-g b1-nav-signin h-10 px-4 text-sm"
            aria-haspopup="dialog" data-testid="nav-login-button" data-replay-auth="client"
            aria-describedby={setupSpotlightVisible ? setupSpotlightDescriptionId : undefined}>
            <LogIn aria-hidden="true" size={16} /> Sign In
          </button>
          {setupSpotlightVisible && <p role="status" id={setupSpotlightDescriptionId} className="b1-setup-hint">
            <Check aria-hidden="true" size={18} /> Your password is set. Use Sign In to access your alphaScreen dashboard.
          </p>}
        </div>
        <button ref={mobileButtonRef} className="b1-mobile-toggle" type="button"
          onClick={() => setMobileOpen(!mobileOpen)} data-testid="nav-mobile-menu-button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} aria-controls="site-mobile-panel">
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      {mobileOpen && <div ref={mobilePanelRef} id="site-mobile-panel" role="dialog" aria-modal="true" aria-label="Navigation" className="b1-mobile-panel">
        {navLinks.map(link => <a key={link.label} href={link.href} className="b1-mobile-link"
          onClick={() => setMobileOpen(false)} data-analytics-cta={link.label} data-analytics-placement="mobile-nav">{link.label}</a>)}
        <button type="button" className="b1-btn-g b1-nav-signin mt-6 w-full p-3" onClick={openSignIn} data-replay-auth="client">Sign In</button>
      </div>}
    </nav>
    <PublicSignInPanel open={loginOpen} onOpenChange={setLoginOpen} title={passwordSetupMode ? "Set up your password" : "Sign In to alphaSource"}
      description={passwordSetupMode ? "Use the secure setup link in your email. Need another link? Enter your buyer email below." : "Access your client dashboard"} returnFocus={() => loginButtonRef.current?.focus()}>
                    <form onSubmit={passwordSetupMode ? (event) => { event.preventDefault(); void startReset(); } : handleSignIn} className="space-y-3">
                    <input
                      type="email"
                      aria-label="Client email address"
                      autoComplete="username"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError("");
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/30 focus:border-[#A380F6] transition-all dark:bg-[#0D1A4A] dark:border-[#2A3568] dark:text-white dark:placeholder:text-white/35"
                      />
                      {!passwordSetupMode && <input
                        type="password"
                        aria-label="Client password"
                        autoComplete="current-password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[#0A1547] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/30 focus:border-[#A380F6] transition-all dark:bg-[#0D1A4A] dark:border-[#2A3568] dark:text-white dark:placeholder:text-white/35"
                      />}
                      <button
                        type="submit"
                      disabled={clientLoginLoading || !email || (!passwordSetupMode && !password)}
                      className="b1-btn-g w-full py-2.5 text-sm"
                    >
                      {passwordSetupMode ? "Email me a secure setup link" : clientLoginLoading ? "Signing in..." : "Sign In"}
                    </button>
                    <button
                        type="button"
                        onClick={passwordSetupMode ? () => setPasswordSetupMode(false) : startReset}
                        className="text-xs text-[#A380F6] hover:underline"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        {passwordSetupMode ? "Already have a password? Sign in" : "Forgot password?"}
                      </button>
                    </form>
                    {PASSKEYS_ENABLED && !passwordSetupMode && (
                      <>
                        <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-[#0A1547]/35 dark:text-white/35">
                          <span className="h-px flex-1 bg-[#0A1547]/10 dark:bg-white/10" />or<span className="h-px flex-1 bg-[#0A1547]/10 dark:bg-white/10" />
                        </div>
                        <button type="button" disabled={clientLoginLoading} onClick={() => void handlePasskeySignIn()} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#A380F6]/40 px-4 py-2.5 text-sm font-semibold text-[#0A1547] transition-colors hover:border-[#A380F6] hover:text-[#A380F6] disabled:opacity-50 dark:text-white dark:hover:text-[#A380F6]">
                          <KeyRound className="h-4 w-4" />
                          Sign in with a passkey
                        </button>
                      </>
                    )}
                    {clientLoginError && (
                      <p className="mt-2 text-xs text-red-500">
                        {clientLoginError}
                      </p>
                    )}
                    {passkeyNotice && (
                      <p role="status" className="mt-2 text-xs text-[#0A1547]/60 dark:text-white/65">
                        {passkeyNotice}
                      </p>
                    )}
                    {emailError && (
                      <p className="mt-2 text-xs text-red-500">{emailError}</p>
                  )}
                  {resetError && (
                      <p className="mt-2 text-xs text-red-500">{resetError}</p>
                    )}
                    {resetSuccess && (
                      <p className="mt-2 text-xs text-[#02D99D]">
                        {resetSuccess}
                      </p>
                    )}

                    <p className="mt-4 text-center text-xs text-[#0A1547]/40 dark:text-white/45">
                      Need access?{" "}
                      <a
                        href="/#contact"
                        className="text-[#A380F6] hover:underline"
                        onClick={() => setLoginOpen(false)}
                      >
                        Get in touch
                      </a>
                    </p>

    </PublicSignInPanel>
  </>;
}
