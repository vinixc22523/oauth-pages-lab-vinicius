# Avaliação: GitHub Actions com IA

Repositório: https://github.com/vinixc22523/oauth-pages-lab-vinicius
Site: Cloudflare Pages + Functions + D1 (`oauth-sessions-vinicius`), login OAuth.

## Tarefa 1: CI a cada commit

Workflow: `.github/workflows/ci.yml`, disparado em todo `push` e em todo `pull_request` para a `main`, com três verificações (segredos versionados, migrações D1 em SQLite local, HTML com `htmlhint`).

- Execução verde: https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38437013010
- Execução vermelha (migração `0002` com `ALTER TABEL`): https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38438582901
- Linha do log com o erro: `Parse error near line 3: near "TABEL": syntax error`
- Por que testar a migração em SQLite antes do D1: o D1 usa o mesmo motor SQLite, então um erro de sintaxe aparece no CI em segundos e sem custo, em vez de quebrar a migração no banco de produção depois do merge.

Ajuste feito no esqueleto: o `git grep` procurava `GOCSPX-` em todo o repositório, inclusive no próprio `ci.yml`, que contém esse texto. O CI falharia sempre. O próprio workflow foi excluído da busca (`':!.github/workflows/ci.yml'`).

## Tarefa 2: proteger a `main` com o CI

Regra em Settings > Branches para `main`: exige pull request, exige o status check `verificar` e não permite bypass para administradores.

- PR bloqueado e depois liberado: https://github.com/vinixc22523/oauth-pages-lab-vinicius/pull/1
  - Bloqueado com `ci / verificar` falhando (commit `0a3b469`, migração com erro): https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38556695070
  - Liberado após a correção na mesma ramificação (commit `874188b`): https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38558239550
- `git push` direto na `main` recusado:

```
PS C:\Users\vinicius.derganho\teste-push> git push origin main
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Delta compression using up to 12 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 293 bytes | 293.00 KiB/s, done.
Total 3 (delta 2), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (2/2), completed with 2 local objects.
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote:
remote: - Changes must be made through a pull request.
remote:
remote: - Required status check "verificar" is expected.
To https://github.com/vinixc22523/oauth-pages-lab-vinicius.git
 ! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs to 'https://github.com/vinixc22523/oauth-pages-lab-vinicius.git'
```

## Tarefa 3: revisão de PR por IA

Workflow: `.github/workflows/revisao-ia.yml`.

- PR com os comentários da IA: https://github.com/vinixc22523/oauth-pages-lab-vinicius/pull/1
  - Comentário que aponta o SQL por concatenação (`WHERE aluno = '${nome}'`) e sugere `prepare(...).bind(nome)`: https://github.com/vinixc22523/oauth-pages-lab-vinicius/pull/1#issuecomment-6167475063
  - Nova revisão no `synchronize` após a correção, confirmando o uso de `prepare().bind()`: https://github.com/vinixc22523/oauth-pages-lab-vinicius/pull/1#issuecomment-6167510552
- Erro de permissão sem `pull-requests: write` (PR #2): https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38558941200
  - Log: `GraphQL: Resource not accessible by integration (addComment)`
  - Permissão restaurada na mesma ramificação e revisão voltou a comentar: https://github.com/vinixc22523/oauth-pages-lab-vinicius/pull/2#issuecomment-6167742129

Ajustes necessários no esqueleto:
1. `actions/ai-inference@v1` aponta para a versão de agosto de 2025, que ainda chamava o GitHub Models e ignora o `COPILOT_GITHUB_TOKEN`. A execução falhava com `Cannot use 'in' operator to search for 'choices' in OK`. A versão baseada no Copilot CLI é a `@v3`.
2. Com a `@v3`, o modelo padrão da ação (`gpt-4.1`) não estava disponível no plano: `Model "gpt-4.1" from --model flag is not available`. Com `model: ''` o Copilot CLI usa o modelo padrão dele.

Crítica à IA (item 4): na revisão https://github.com/vinixc22523/oauth-pages-lab-vinicius/pull/1#issuecomment-6167468889 a IA afirmou que o `migrar.yml` "pode sinalizar sucesso mesmo com a migração falhando" porque usa `wrangler ... | tee migracao.log` sem `pipefail`. A afirmação está errada: no GitHub Actions o shell padrão dos passos `run` em Linux é `bash -e -o pipefail`, então uma falha do wrangler derruba o passo mesmo com o `tee`. Na revisão seguinte ela também disse que `model: ''` "não garante a seleção do modelo padrão" e sugeriu omitir o campo, o que também está errado: o `action.yml` da `v3` documenta que string vazia deixa o CLI escolher, e omitir o campo volta para `gpt-4.1`, justamente o modelo que falhou neste repositório. Além disso, ela anexou um menu ("Fix highest severity issues", "Commit a summary of findings") que sobra do modo interativo do Copilot CLI e é irrelevante num comentário de PR.

## Tarefa 4: migrações D1 depois do merge

Workflow: `.github/workflows/migrar.yml`, em `push` na `main` com `paths: ['migrations/**']`.

- Execução do merge do PR #1 (aplicou `0001` e `0002` no D1 remoto): https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38558530458
- Saída do `PRAGMA table_info(notas)`:

```
Executado no D1 remoto (console do D1, equivalente a `npx wrangler d1 execute oauth-sessions-vinicius --remote --command "PRAGMA table_info(notas)"`):

cid  name   type     notnull  dflt_value  pk
0    id     INTEGER  0        null        1
1    aluno  TEXT     1        null        0
2    nota   REAL     1        null        0
3    turma  TEXT     0        null        0
```

- Segundo merge sem tocar `migrations/` (PR #2, commit `d978104`): rodou apenas o `ci` (https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/runs/38560316314). A lista de execuções do `migrar` tem uma única execução, a do PR #1: https://github.com/vinixc22523/oauth-pages-lab-vinicius/actions/workflows/migrar.yml

Bônus: o mesmo workflow chama `actions/ai-inference` e grava o resumo em `$GITHUB_STEP_SUMMARY`, visível na execução acima ("Resumo das migrações (IA)").

## Perguntas

1. **Por que o `ci.yml` roda duas vezes com PR aberto?** O workflow escuta `push` em qualquer ramificação e `pull_request` para a `main`. Um push numa ramificação com PR aberto gera os dois eventos: `push` e `pull_request` (tipo `synchronize`). As duas execuções publicam um check com o mesmo nome, `verificar`, no commit da ramificação, e no PR as duas aparecem como "Required". A que representa o resultado do merge é a do evento `pull_request`, porque ela testa o commit de merge `refs/pull/N/merge` contra a `main` atual.

2. **Por que um PR vindo de fork não usa `secrets.COPILOT_PAT`?** Num PR de fork, o código do workflow e dos scripts vem de quem abriu o PR, uma pessoa de fora do repositório. Se os segredos fossem entregues a essa execução, bastaria alterar um passo para imprimir o token ou enviá-lo para um servidor externo. A regra impede o vazamento de segredos (exfiltração de credenciais) por meio de um PR malicioso.

3. **Por que declarar `permissions` em vez de usar o padrão do `GITHUB_TOKEN`?** Pelo princípio do menor privilégio. Ao declarar `permissions`, tudo o que não foi listado fica sem acesso, e o token recebe apenas `contents: read` e `pull-requests: write`. Se um passo, uma ação de terceiros ou a própria saída da IA for manipulada, o estrago fica limitado. O teste do item 3 mostrou isso: sem `pull-requests: write`, o comentário foi negado com `Resource not accessible by integration`.

4. **A revisão da IA pode substituir o status check?** Não. O status check é determinístico: a migração com `ALTER TABEL` falha sempre e bloqueia o merge. A IA não é determinística e errou neste trabalho: afirmou que faltava `pipefail` quando o Actions já usa `pipefail` por padrão, contestou o `model: ''` que de fato resolveu a falha e incluiu um menu irrelevante no comentário. Ela foi útil como segundo olhar, porque apontou a injeção de SQL e uma duplicação no README, mas serve para complementar a revisão, não para decidir o merge.
