// Leitura e escrita de cookies, mais respostas HTTP padronizadas.

export const TX_COOKIE = "__Host-oauth-tx";
export const SESSION_COOKIE = "__Host-session";
export const TX_MAX_AGE = 600;        // 10 minutos
export const SESSION_MAX_AGE = 28800; // 8 horas

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim() || null;
  }
  return null;
}

// Prefixo __Host- exige: Secure, Path=/ e ausência de Domain.
export function txCookie(value) {
  return `${TX_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TX_MAX_AGE}`;
}
export function clearTxCookie() {
  return `${TX_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export function sessionCookie(value) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}
export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// Resposta JSON sempre com Cache-Control: no-store.
export function json(body, status = 200, extraHeaders = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  for (const [k, v] of extraHeaders) headers.append(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

// Erro genérico: não revela detalhes internos.
export function fail(status, code, extraHeaders = []) {
  return json({ error: code }, status, extraHeaders);
}

export function notFound() {
  return fail(404, "not_found");
}

export function methodNotAllowed(allowed) {
  return fail(405, "method_not_allowed", [["Allow", allowed]]);
}
