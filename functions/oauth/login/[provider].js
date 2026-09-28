// GET /oauth/login/{google|github}
// Cria a transação no D1, grava o cookie temporário e redireciona ao provedor.

import { randomToken, sha256, nowSeconds } from "../../_shared/crypto.js";
import { txCookie, notFound, methodNotAllowed, fail, TX_MAX_AGE } from "../../_shared/cookies.js";
import { getProvider, redirectUri } from "../../_shared/providers.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  // 1. aceitar somente google ou github
  const name = params.provider;
  const provider = getProvider(name);
  if (!provider) return notFound();

  try {
    // 2. gerar a transação (valores brutos só existem nesta requisição)
    const txId = randomToken();
    const state = randomToken();
    const codeVerifier = randomToken();
    const nonce = provider.usesNonce ? randomToken() : null; // nonce só no Google
    const codeChallenge = await sha256(codeVerifier);        // PKCE S256
    const now = nowSeconds();

    // limpeza oportunista de transações vencidas
    await env.DB.prepare("DELETE FROM oauth_transactions WHERE expires_at <= ?").bind(now).run();

    // o D1 guarda resumos do cookie e do state; code_verifier e nonce ficam no servidor
    await env.DB.prepare(
      `INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(await sha256(txId), name, await sha256(state), nonce, codeVerifier, now + TX_MAX_AGE)
      .run();

    // 4. montar o pedido de autorização
    const url = new URL(provider.authorizeUrl);
    url.searchParams.set("client_id", env[provider.clientIdVar]);
    url.searchParams.set("redirect_uri", redirectUri(env, name));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (provider.scope) url.searchParams.set("scope", provider.scope);
    if (nonce) url.searchParams.set("nonce", nonce);
    // Client Secret e code_verifier NUNCA entram nesta URL.

    // 3 e 5. cookie temporário + redirecionamento 302
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        "Set-Cookie": txCookie(txId),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return fail(500, "login_start_failed");
  }
}
