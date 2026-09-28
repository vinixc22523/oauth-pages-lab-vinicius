// GET /oauth/callback/{google|github}
// Valida o retorno, troca o código, confirma a identidade e cria a sessão.

import { randomToken, sha256, timingSafeEqual, nowSeconds } from "../../_shared/crypto.js";
import {
  TX_COOKIE, getCookie, clearTxCookie, sessionCookie,
  fail, notFound, methodNotAllowed, SESSION_MAX_AGE,
} from "../../_shared/cookies.js";
import { getProvider, redirectUri, GITHUB_API_VERSION, USER_AGENT } from "../../_shared/providers.js";
import { verifyGoogleIdToken } from "../../_shared/oidc.js";

// Toda falha limpa o cookie temporário e não revela detalhes.
function reject(status, code) {
  return fail(status, code, [["Set-Cookie", clearTxCookie()], ["Referrer-Policy", "no-referrer"]]);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  const name = params.provider;
  const provider = getProvider(name);
  if (!provider) return notFound();

  const url = new URL(request.url);

  // 1. recusar error ou ausência de code e state
  if (url.searchParams.has("error")) return reject(400, "authorization_denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return reject(400, "invalid_callback");

  // 2. exigir o cookie temporário
  const txId = getCookie(request, TX_COOKIE);
  if (!txId) return reject(400, "missing_transaction");

  try {
    const now = nowSeconds();

    // 3 e 5. localizar a transação não expirada e APAGÁ-LA na mesma operação.
    // DELETE ... RETURNING consome a transação de forma atômica: uma repetição falha.
    const tx = await env.DB.prepare(
      `DELETE FROM oauth_transactions
       WHERE id_hash = ? AND expires_at > ?
       RETURNING provider, state_hash, nonce, code_verifier`
    ).bind(await sha256(txId), now).first();

    if (!tx) return reject(400, "invalid_transaction");
    if (tx.provider !== name) return reject(400, "invalid_transaction");

    // 4. comparar o resumo do state com o valor do D1 (antes de trocar o código)
    if (!timingSafeEqual(await sha256(state), tx.state_hash)) {
      return reject(400, "invalid_state");
    }

    // 6 e 7. trocar o código e confirmar a identidade conforme o provedor
    const identity = name === "google"
      ? await handleGoogle(env, provider, code, tx)
      : await handleGithub(env, provider, code, tx);
    if (!identity) return reject(401, "identity_not_confirmed");

    // 8. criar a sessão opaca (D1 guarda apenas o resumo)
    const sessionId = randomToken();
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
    await env.DB.prepare(
      `INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      await sha256(sessionId),
      identity.issuer,
      identity.subject,
      identity.email,
      identity.displayName,
      now + SESSION_MAX_AGE,
      now
    ).run();

    // 9 e 10. limpar o cookie temporário, gravar a sessão e voltar ao site
    const headers = new Headers({
      Location: env.PUBLIC_BASE_URL,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    headers.append("Set-Cookie", clearTxCookie());
    headers.append("Set-Cookie", sessionCookie(sessionId));
    return new Response(null, { status: 302, headers });
  } catch {
    // Não registrar o corpo da troca de tokens nem a resposta completa.
    return reject(502, "callback_failed");
  }
}

// ---------- Google: id_token OIDC validado no servidor ----------
async function handleGoogle(env, provider, code, tx) {
  const clientId = env[provider.clientIdVar];
  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(env, "google"),
      client_id: clientId,
      client_secret: env[provider.clientSecretVar], // Client Secret só aparece aqui
      code_verifier: tx.code_verifier,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data.id_token !== "string") return null;

  const claims = await verifyGoogleIdToken(data.id_token, { clientId, nonce: tx.nonce });
  // access_token e refresh_token do Google são descartados: não são guardados nem expostos.
  return {
    issuer: provider.issuer,
    subject: claims.sub,
    email: typeof claims.email === "string" && claims.email_verified === true ? claims.email : null,
    displayName: typeof claims.name === "string" ? claims.name : null,
  };
}

// ---------- GitHub: /user com o access_token, depois revogação ----------
async function handleGithub(env, provider, code, tx) {
  const clientId = env[provider.clientIdVar];
  const clientSecret = env[provider.clientSecretVar];

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret, // Client Secret só aparece aqui e na revogação
      code,
      redirect_uri: redirectUri(env, "github"),
      code_verifier: tx.code_verifier,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json(); // o GitHub responde 200 mesmo com erro: conferir campos
  if (data.error || typeof data.access_token !== "string") return null;
  if (typeof data.token_type !== "string" || data.token_type.toLowerCase() !== "bearer") return null;

  const accessToken = data.access_token;
  const apiHeaders = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": USER_AGENT, // a API do GitHub recusa chamadas sem User-Agent
  };

  // consultar o perfil autenticado
  let user = null;
  let revoked = false;
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: { ...apiHeaders, Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.status === 200) user = await userRes.json();
  } finally {
    // revogar SEMPRE a autorização (mesmo se /user falhar)
    revoked = await revokeGithubGrant(clientId, clientSecret, accessToken, apiHeaders);
  }

  // a sessão só é criada se /user deu 200 com id inteiro E a revogação deu 204
  if (!revoked) return null;
  if (!user || !Number.isInteger(user.id)) return null;

  return {
    issuer: provider.issuer,
    subject: String(user.id), // id numérico estável; login/nome servem só para exibição
    email: typeof user.email === "string" ? user.email : null, // pode ser nulo (sem user:email)
    displayName: typeof user.name === "string" && user.name ? user.name : user.login ?? null,
  };
}

async function revokeGithubGrant(clientId, clientSecret, accessToken, apiHeaders) {
  const res = await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`, {
    method: "DELETE",
    headers: {
      ...apiHeaders,
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: JSON.stringify({ access_token: accessToken }),
  });
  return res.status === 204;
}
