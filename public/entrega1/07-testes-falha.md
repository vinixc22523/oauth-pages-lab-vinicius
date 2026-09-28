# Testes de falha

Projeto: https://oauth-pages-lab-vinicius.pages.dev
Data de execução: AAAA-MM-DD
Responsável: SEU NOME

## Caso 1: retorno sem cookie temporário

- **Preparação:** login iniciado em janela comum e interrompido na página do provedor. URL de autorização copiada para uma janela privativa, sem o cookie `__Host-oauth-tx`.
- **Pedido enviado:** `GET /oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]` sem o cookie `__Host-oauth-tx`.
- **Resultado esperado:** HTTP 400 `{"error":"missing_transaction"}` e nenhuma sessão criada.
- **Resultado observado:** PREENCHER

## Caso 2: state alterado

- **Preparação:** login iniciado e interrompido na página do provedor. Um caractere do parâmetro `state` foi alterado na barra de endereço.
- **Pedido enviado:** `GET /oauth/callback/{provedor}?code=[REMOVIDO]&state=[REMOVIDO]` com state modificado.
- **Resultado esperado:** HTTP 400 `{"error":"invalid_state"}` (ou `invalid_transaction`) antes da troca do código. Nenhuma sessão criada.
- **Resultado observado:** PREENCHER

## Caso 3: reutilização da transação

- **Preparação:** login concluído com sucesso. URL da requisição de retorno copiada no painel Network (Copy URL) e aberta novamente.
- **Pedido enviado:** `GET /oauth/callback/{provedor}?code=[REMOVIDO]&state=[REMOVIDO]` repetido.
- **Resultado esperado:** HTTP 400 `{"error":"missing_transaction"}` ou `{"error":"invalid_transaction"}`, pois a transação já foi apagada do D1.
- **Resultado observado:** PREENCHER

## Caso 4: sessão expirada

- **Preparação:** sessão de teste criada. No console D1 foi executado `UPDATE sessions SET expires_at = 0;`.
- **Pedido enviado:** `GET /api/me` com o cookie `__Host-session=[REMOVIDO]`.
- **Resultado esperado:** HTTP 401 `{"error":"unauthenticated"}`.
- **Resultado observado:** PREENCHER

## Caso 5: origem inválida na saída

- **Preparação:** sessão válida aberta em URL_BASE. Em outra aba, em https://example.com, foi executado no console: `fetch("https://oauth-pages-lab-vinicius.pages.dev/oauth/logout", { method: "POST", credentials: "include" })`.
- **Pedido enviado:** `POST /oauth/logout` com `Origin: https://example.com`.
- **Resultado esperado:** HTTP 403 `{"error":"invalid_origin"}`. A sessão original continua válida (`/api/me` responde 200 na aba de URL_BASE).
- **Resultado observado:** PREENCHER

## Caso 6: reutilização do cookie revogado

- **Preparação:** valor do cookie `__Host-session` copiado temporariamente. Logout executado. Cookie restaurado manualmente nas ferramentas de desenvolvimento. A cópia foi apagada logo depois.
- **Pedido enviado:** `GET /api/me` com o cookie `__Host-session=[REMOVIDO]` restaurado.
- **Resultado esperado:** HTTP 401 `{"error":"unauthenticated"}`, pois a linha foi removida do D1.
- **Resultado observado:** PREENCHER
