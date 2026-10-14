// GET /api/notas?aluno=<nome>
// Lista as notas de um aluno na tabela notas do D1.

import { json, fail, methodNotAllowed } from "../_shared/cookies.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return methodNotAllowed("GET");

  const nome = new URL(request.url).searchParams.get("aluno");
  if (!nome) return fail(400, "aluno ausente");

  // O valor vai como parametro (bind), nunca concatenado no SQL.
  const { results } = await env.DB.prepare("SELECT * FROM notas WHERE aluno = ?").bind(nome).all();

  return json({ aluno: nome, notas: results });
}
