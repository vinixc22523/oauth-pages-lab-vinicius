# oauth-pages-lab-vinicius
Laboratório de login OAuth/OIDC no Cloudflare Pages

## Automação com GitHub Actions

| Workflow | Gatilho | O que faz |
|---|---|---|
| `ci.yml` | todo `push` e PR para a `main` | procura segredos versionados, aplica as migrações D1 num SQLite local e valida o HTML |
| `revisao-ia.yml` | PR aberto ou atualizado | envia o diff ao Copilot (`actions/ai-inference@v3`) e comenta a revisão no PR |
| `migrar.yml` | `push` na `main` que altera `migrations/` | aplica as migrações no D1 remoto e resume o resultado com IA |

A `main` é protegida: só recebe mudanças por PR com o check `verificar` aprovado.
