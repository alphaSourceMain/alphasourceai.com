// Presentation-only handoff after the server confirms a paid buyer needs setup.
// Never carry a checkout reference or an authentication capability into this URL.
export const CLIENT_PASSWORD_SETUP_HREF = "/support/?signin=client&setup=password";

export function checkoutPasswordSetupHref(responseOk: boolean, body: unknown): string | null {
  return responseOk && !!body && typeof body === "object" &&
    (body as { status?: unknown }).status === "password_required"
    ? CLIENT_PASSWORD_SETUP_HREF : null;
}
