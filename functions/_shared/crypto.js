// Utilidades criptográficas usando apenas Web Crypto (sem bibliotecas externas).

const encoder = new TextEncoder();

// Converte bytes em Base64URL sem preenchimento ("=").
export function base64urlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Converte Base64URL em bytes. Recusa caracteres fora do alfabeto.
export function base64urlDecode(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]*$/.test(text)) {
    throw new Error("base64url inválido");
  }
  let b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// 32 bytes aleatórios -> 43 caracteres Base64URL.
// Usado para: id da transação, state, nonce, code_verifier e id da sessão.
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

// Resumo SHA-256 em Base64URL.
// Usado para: code_challenge (PKCE S256) e para os resumos guardados no D1.
export async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return base64urlEncode(new Uint8Array(digest));
}

// Comparação em tempo constante, para não vazar informação por tempo de resposta.
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
