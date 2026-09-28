// GET /api/me
// Resolve a sessão pelo resumo do cookie e devolve somente o perfil mínimo.

import { sha256, nowSeconds } from "../_shared/crypto.js";
import { SESSION_COOKIE, getCookie, json, fail, methodNotAllowed } from "../_shared/cookies.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  const sessionId = getCookie(request, SESSION_COOKIE);
  if (!sessionId) return fail(401, "unauthenticated");

  const row = await env.DB.prepare(
    `SELECT issuer, subject, email, display_name
     FROM sessions WHERE id_hash = ? AND expires_at > ?`
  ).bind(await sha256(sessionId), nowSeconds()).first();

  if (!row) return fail(401, "unauthenticated");

  return json({
    issuer: row.issuer,
    subject: row.subject,
    email: row.email,
    displayName: row.display_name,
  });
}
