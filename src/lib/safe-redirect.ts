/** Aceita apenas caminhos internos ("/x"), bloqueando open redirect ("//evil", "/\evil", URLs absolutas). */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
