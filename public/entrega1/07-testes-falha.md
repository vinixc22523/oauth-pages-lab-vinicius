# Testes de falha

Projeto: https://oauth-pages-lab-vinicius.pages.dev
Data de execução: 2026-09-28 e 2026-09-30
Responsável: SEU NOME

## Caso 1: retorno sem cookie temporário

- **Preparação:** requisição à rota de retorno feita sem nenhum cookie (equivalente a concluir o login em uma janela privativa que não possui `__Host-oauth-tx`).
- **Pedido enviado:** `GET /oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]` sem o cookie `__Host-oauth-tx`.
- **Resultado esperado:** HTTP 400 `{"error":"missing_transaction"}` e nenhuma sessão criada.
- **Resultado observado:** HTTP 400 `{"error":"missing_transaction"}`. Nenhuma sessão criada. Resultado conforme o esperado.

## Caso 2: state alterado

- **Preparação:** login iniciado em `/oauth/login/github`, o que criou a transação no D1 e o cookie `__Host-oauth-tx`. A rota de retorno foi chamada com um valor de `state` diferente do gerado.
- **Pedido enviado:** `GET /oauth/callback/{provedor}?code=[REMOVIDO]&state=[REMOVIDO]` com state modificado.
- **Resultado esperado:** HTTP 400 `{"error":"invalid_state"}` (ou `invalid_transaction`) antes da troca do código. Nenhuma sessão criada.
- **Resultado observado:** HTTP 400 `{"error":"invalid_state"}`, recusado antes da troca do código. Uma nova tentativa com a mesma transação devolveu HTTP 400 `{"error":"missing_transaction"}`, pois a transação é apagada na primeira leitura. Nenhuma sessão criada. Resultado conforme o esperado.

## Caso 3: reutilização da transação

- **Preparação:** login concluído com sucesso. URL da requisição de retorno copiada no painel Network (Copy URL) e aberta novamente.
- **Pedido enviado:** `GET /oauth/callback/{provedor}?code=[REMOVIDO]&state=[REMOVIDO]` repetido.
- **Resultado esperado:** HTTP 400 `{"error":"missing_transaction"}` ou `{"error":"invalid_transaction"}`, pois a transação já foi apagada do D1.
- **Resultado observado:** HTTP 400 `{"error":"missing_transaction"}`. A transação e o cookie temporário já tinham sido removidos na primeira conclusão, então a repetição foi recusada e nenhuma nova sessão foi criada. Resultado conforme o esperado.

## Caso 4: sessão expirada

- **Preparação:** sessão de teste criada. No console D1 foi executado `UPDATE sessions SET expires_at = 0;`.
- **Pedido enviado:** `GET /api/me` com o cookie `__Host-session=[REMOVIDO]`.
- **Resultado esperado:** HTTP 401 `{"error":"unauthenticated"}`.
- **Resultado observado:** Antes do UPDATE, `/api/me` respondia 200. Depois de `UPDATE sessions SET expires_at = 0;`, `/api/me` respondeu HTTP 401 `{"error":"unauthenticated"}`. Resultado conforme o esperado.

## Caso 5: origem inválida na saída

- **Preparação:** sessão válida aberta em URL_BASE. Em outra aba, em https://example.com, foi executado no console: `fetch("https://oauth-pages-lab-vinicius.pages.dev/oauth/logout", { method: "POST", credentials: "include" })`.
- **Pedido enviado:** `POST /oauth/logout` com `Origin: https://example.com`.
- **Resultado esperado:** HTTP 403 `{"error":"invalid_origin"}`. A sessão original continua válida (`/api/me` responde 200 na aba de URL_BASE).
- **Resultado observado:** O navegador bloqueou a leitura da resposta (CORS) e o cookie `SameSite=Strict` não foi enviado. Pelo código, a rota só aceita `Origin` igual a PUBLIC_BASE_URL e responde HTTP 403 `{"error":"invalid_origin"}` nos demais casos. Na aba de URL_BASE, `/api/me` continuou respondendo 200: a sessão original permaneceu válida. Resultado conforme o esperado.

## Caso 6: reutilização do cookie revogado

- **Preparação:** valor do cookie `__Host-session` copiado temporariamente. Logout executado. Cookie restaurado manualmente nas ferramentas de desenvolvimento. A cópia foi apagada logo depois.
- **Pedido enviado:** `GET /api/me` com o cookie `__Host-session=[REMOVIDO]` restaurado.
- **Resultado esperado:** HTTP 401 `{"error":"unauthenticated"}`, pois a linha foi removida do D1.
- **Resultado observado:** HTTP 401 `{"error":"unauthenticated"}`. Como a linha da sessão foi removida do D1 no logout, o cookie restaurado não recuperou a sessão. A cópia do valor foi apagada logo depois do teste. Resultado conforme o esperado.
