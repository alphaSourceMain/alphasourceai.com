// Generic email recovery remains a fallback, not the normal paid-buyer handoff.
export const CLIENT_PASSWORD_SETUP_HREF = "/support/?signin=client&setup=password";
const SETUP_PROOF_KEY = "alphascreen:checkout_setup_proof:v1";
const SETUP_PROOF_TTL_MS = 60 * 60 * 1000;
const PASSWORD_TOKEN_KEY = "alphascreen:checkout_password_token:v1";

export function rememberCheckoutSetupProof(sessionId: string, token: string): void {
  try {
    window.sessionStorage.setItem(SETUP_PROOF_KEY, JSON.stringify({ sessionId, token, savedAt: Date.now() }));
  } catch {
    // Storage-restricted browsers can still use their secure setup email.
  }
}

export function consumeCheckoutSetupProof(sessionId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(SETUP_PROOF_KEY);
    window.sessionStorage.removeItem(SETUP_PROOF_KEY);
    const proof = JSON.parse(raw || "null");
    const age = Date.now() - proof?.savedAt;
    return proof?.sessionId === sessionId && typeof proof?.token === "string"
      && proof.token.length >= 32 && proof.token.length <= 512
      && Number.isFinite(age) && age >= 0 && age <= SETUP_PROOF_TTL_MS ? proof.token : null;
  } catch {
    return null;
  }
}

export function checkoutPasswordSetupHref(responseOk: boolean, body: unknown): string | null {
  if (!responseOk || !body || typeof body !== "object") return null;
  const response = body as { status?: unknown; password_setup_token_hash?: unknown };
  if (response.status !== "password_required" || typeof response.password_setup_token_hash !== "string"
    || !/^[a-f0-9]{64}$/i.test(response.password_setup_token_hash)) return null;
  // Fixed same-origin route; the capability never enters the address bar,
  // history or a referrer. The existing password form consumes it once.
  try {
    window.sessionStorage.setItem(PASSWORD_TOKEN_KEY, JSON.stringify({ token: response.password_setup_token_hash, savedAt: Date.now() }));
    return "/pwreset?origin=client";
  } catch {
    return null;
  }
}

export function consumeCheckoutPasswordToken(): string | null {
  try {
    const raw = window.sessionStorage.getItem(PASSWORD_TOKEN_KEY);
    window.sessionStorage.removeItem(PASSWORD_TOKEN_KEY);
    const item = JSON.parse(raw || "null");
    const age = Date.now() - item?.savedAt;
    return typeof item?.token === "string" && /^[a-f0-9]{64}$/i.test(item.token)
      && Number.isFinite(age) && age >= 0 && age <= 120000 ? item.token : null;
  } catch {
    return null;
  }
}
