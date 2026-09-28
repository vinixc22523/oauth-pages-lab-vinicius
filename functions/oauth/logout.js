// POST /oauth/logout
// Revoga a sessão LOCAL. Não encerra a sessão global no Google nem no GitHub.

import { sha256 } from "../_shared/crypto.js";
import { SESSION_COOKIE, getCookie, clearSessionCookie, fail, methodNotAllowed } from "../_shared/cookies.js";

export async function onRequest(context) {
  const { request, env } = context;

  // 1. aceitar somente POST
  if (request.method !== "POST") return methodNotAllowed("POST");

  // 2. Origin exatamente igual a PUBLIC_BASE_URL
  if (request.headers.get("Origin") !== env.PUBLIC_BASE_URL) {
    return fail(403, "invalid_origin");
  }

  // 3. remover a linha da sessão no D1
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(sessionId)).run();
  }

  // 4 e 5. expirar o cookie e voltar à página inicial (303 = GET após POST)
  return new Response(null, {
    status: 303,
    headers: {
      Location: env.PUBLIC_BASE_URL,
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store",
    },
  });
}
