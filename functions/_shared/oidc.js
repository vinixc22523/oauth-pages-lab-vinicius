// Validação do id_token do Google (OIDC) sem bibliotecas externas.

import { base64urlDecode, timingSafeEqual, nowSeconds } from "./crypto.js";

const GOOGLE_ISSUER = "https://accounts.google.com";
const ACCEPTED_ISS = [GOOGLE_ISSUER, "accounts.google.com"];
const DISCOVERY_URL = `${GOOGLE_ISSUER}/.well-known/openid-configuration`;
const CLOCK_SKEW = 60; // tolerância de relógio, em segundos

const decoder = new TextDecoder();

function decodeJsonPart(part) {
  return JSON.parse(decoder.decode(base64urlDecode(part)));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("falha ao obter documento OIDC");
  return res.json();
}

// Devolve as claims validadas ou lança erro.
export async function verifyGoogleIdToken(idToken, { clientId, nonce }) {
  // 1. três partes não vazias
  if (typeof idToken !== "string") throw new Error("id_token ausente");
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    throw new Error("formato de JWT inválido");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  // 2. cabeçalho com alg RS256
  const header = decodeJsonPart(headerB64);
  if (header.alg !== "RS256") throw new Error("alg não permitido");
  if (typeof header.kid !== "string") throw new Error("kid ausente");

  // 3. documento de descoberta do emissor esperado
  const discovery = await fetchJson(DISCOVERY_URL);
  if (discovery.issuer !== GOOGLE_ISSUER || typeof discovery.jwks_uri !== "string") {
    throw new Error("documento de descoberta inesperado");
  }

  // 4. JWKS indicado por jwks_uri
  const jwks = await fetchJson(discovery.jwks_uri);

  // 5. chave pelo kid
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) throw new Error("chave não encontrada");

  // 6. importar a JWK
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // 7. verificar a assinatura sobre "cabeçalho.payload"
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64urlDecode(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) throw new Error("assinatura inválida");

  // 8. validar iss, aud, exp, iat e nonce ANTES de usar sub, nome e e-mail
  const claims = decodeJsonPart(payloadB64);
  const now = nowSeconds();

  if (!ACCEPTED_ISS.includes(claims.iss)) throw new Error("iss inválido");

  const audOk = Array.isArray(claims.aud)
    ? claims.aud.includes(clientId) && claims.azp === clientId
    : claims.aud === clientId;
  if (!audOk) throw new Error("aud inválido");

  if (typeof claims.exp !== "number" || claims.exp <= now - CLOCK_SKEW) throw new Error("token expirado");
  if (typeof claims.iat !== "number" || claims.iat > now + CLOCK_SKEW) throw new Error("iat inválido");
  if (!timingSafeEqual(claims.nonce, nonce)) throw new Error("nonce inválido");
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new Error("sub ausente");

  return claims;
}
