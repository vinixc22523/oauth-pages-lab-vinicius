// Dados fixos de cada provedor. Nenhum segredo aqui: os valores vêm de context.env.

export const GITHUB_API_VERSION = "2026-03-10";
export const USER_AGENT = "oauth-pages-lab";

const PROVIDERS = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    issuer: "https://accounts.google.com",
    scope: "openid email profile",
    usesNonce: true,
    clientIdVar: "GOOGLE_CLIENT_ID",
    clientSecretVar: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    issuer: "https://github.com",
    scope: null, // sem escopos: apenas o perfil público
    usesNonce: false,
    clientIdVar: "GITHUB_CLIENT_ID",
    clientSecretVar: "GITHUB_CLIENT_SECRET",
  },
};

// Aceita somente "google" ou "github". Qualquer outro valor -> null (rota responde 404).
export function getProvider(name) {
  if (typeof name !== "string") return null;
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name) ? PROVIDERS[name] : null;
}

// URL de retorno exata, igual à cadastrada no provedor.
export function redirectUri(env, name) {
  return `${env.PUBLIC_BASE_URL}/oauth/callback/${name}`;
}
