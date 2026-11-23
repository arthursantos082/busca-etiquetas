# plan.md — Busca por Etiquetas (ChatClinic)

> Documento vivo. Segue o fluxo *spec-driven* (Especificar → Planejar → Tarefas → Implementar),
> com uma porta de revisão humana entre cada fase. **Fase atual: DISTRIBUIR** — v1.1.0 fechada em 2026-11-23 (instalada e conferida nesta máquina).
> A spec foi fechada no grill-me de 2026-11-23 (ver §3 e §7). Andamento das tarefas em §8.

---

## 1. Objetivo

Criar a função **"Busca por Etiquetas"** como **módulo da extensão existente Etiquetas ChatClinic** (A → v1.1.0).
Ela permite ao atendente **filtrar a lista de conversas do ChatClinic pelas etiquetas** que ele mesmo marcou com A,
usando as mesmas etiquetas e marcações (sem recriar nada).

Exemplo de uso (rotina diária): escolho *Retornar ligação* na barra de etiquetas → a lista da esquerda mostra só quem
tem essa etiqueta → clico no item → a conversa abre, como já acontece hoje.

---

## 2. O que foi estudado (fatos)

### 2.1 Ambiente
- Chrome 157, perfil `Default`.
- **Claude in Chrome não está conectado** neste momento (nenhum navegador conectado).
  Por isso ainda **não estudei o DOM do app.chatclinic.com.br** ao vivo — ver §6, pendência P1.
- Skills do Addy Osmani + `grill-me`/`grilling` copiadas para `.claude/skills/` deste projeto
  (origem: `Desktop/Automacao-SGCOR-Protege/.claude/skills/`). Carregam ao abrir uma nova conversa.
- Skills do **Caveman** (JuliusBrussee/caveman, Apache-2.0) também em `.claude/skills/`, e os agentes cavecrew em
  `.claude/agents/`. O que foi e o que não foi copiado está em `.claude/skills/references/caveman/SOURCE.md`.
  Sobreposições a vigiar: `caveman-review` × `code-review-and-quality`, `investigate-first` × `debugging-and-error-recovery`,
  `safe-refactor` × `code-simplification`, `surgical-patch`/`lean-build` × `incremental-implementation`.

### 2.2 Extensão existente — "Etiquetas ChatClinic" v1.0.1 (autor: Gleidston Santos)
- Local: `C:\Users\Master\Downloads\etiquetas-chatclinic\` — instalada **sem compactação** (modo dev).
- ID no Chrome: `imcjeeffbjkhbgnganjdanbcbbgjjcdn` (derivado do caminho da pasta; **não há `key` no manifest**,
  então o ID muda se a pasta mudar de lugar ou em outro computador).
- MV3, permissão única: `storage`. Content script em `https://app.chatclinic.com.br/*` (`all_frames`).

| Arquivo | Papel |
|---|---|
| `background.js` | Cria 3 etiquetas padrão na instalação; abre o gerenciador a pedido. |
| `content.js` | No ChatClinic: acha o cabeçalho da conversa (texto `PROTOCOLO`), pega o **nome** acima dele, injeta botão "🏷 Etiquetas" + chips; na lista à esquerda, acha textos iguais a nomes etiquetados e injeta chips. Popover em Shadow DOM para marcar/desmarcar. |
| `manager.html/js` | Popup: CRUD de etiquetas (nome ≤25, cor), lista "Conversas etiquetadas", exportar/importar JSON. |

**Modelo de dados** (`chrome.storage.local`, da extensão A):
```js
library:     [{ id: 'retornar-ligacao', name: 'Retornar ligação', color: '#7C3AED' }, ...]
assignments: { 'Nome Exato do Contato': [{ id: '<tagId>', at: 1732370000000 }, ...] }
```
Backup exportado: `{ app: 'etiquetas-chatclinic', version: 1, exportedAt, library, assignments }`.

**Pontos importantes para a busca:**
1. A chave do cliente é **o nome exibido** (normalizado: espaços colapsados + trim). Não há telefone/ID.
   Dois contatos com o mesmo nome compartilham etiquetas — limitação herdada.
2. Cada marcação tem timestamp (`at`) → dá para filtrar "marcada há X dias".
3. Os dados ficam **só no navegador de cada atendente**. Já existem dados reais neste perfil.
4. A extensão A não expõe nenhuma API para outras extensões (não há `onMessageExternal`
   nem `externally_connectable`).

### 2.3a ChatClinic ao vivo (estudado em 2026-11-23, somente leitura, sem abrir conversas)
- Página principal `app.chatclinic.com.br/` → o app roda num **iframe de mesma origem**
  (`/blank_chat_v2/blank_chat_v2.php`). É PHP + **jQuery 3.4.1** + Bootstrap + socket.io. Não usa framework SPA.
  A extensão A funciona porque usa `all_frames: true`.
- **Lista de conversas:** `ul#atendimentos_contatos > div.conversation#contato-<id>`. Cada item traz atributos úteis:
  - `data-id`: **ID numérico do contato**. É estável e melhor como chave do que o nome.
  - `data-id8`: telefone (13 dígitos).
  - `data-etiq`: etiqueta **nativa** do ChatClinic, uma só (98 de 100 = "Lotérico").
  - `data-atendente`: e-mail do atendente.
  - `data-depart`: departamento.
  - `onclick="chamarChatAtendimento(this)"`: **é assim que a conversa abre**. Para abrir, basta um clique no item.
- Título: `.conversation__name--title`. A extensão A injeta `span[data-etq="strip"]` logo depois de `.conversation__name`.
- **A lista é paginada** (`#paginaAtual` = 2, 100 itens carregados; abas Atendimento 86 / Espera 46 / Contatos).
  Um cliente etiquetado **pode não estar carregado na lista** (conversa encerrada ou em página não carregada).
- **Busca nativa:** `#userSearch` ("Procure aqui..."), `keyup` com debounce → `pesquisa_atendimentos()`.
  Essa função remove acentos, esconde/mostra itens e pode chamar `listar_atendimentos()`. Existe também
  `pesquisar_connversa()` → `filtro_conversa_chat.php` e a aba **Contatos** (`buscar_lista_contatos`).
- **Etiquetas nativas do ChatClinic já existem:** `buscarEtiquetas(nome)` (filtra a lista por `data-etiq`),
  `filtrar_etiquetas()` (AJAX para `blank_chat_backend.php`), `cadastro_etiqueta`, além do botão de filtro
  avançado (funil). São **do servidor e compartilhadas pela equipe**, mas cada contato tem uma só (pelo que vi).
- Uso real da extensão A neste perfil (chips visíveis nos 100 itens): PORTO 40, TOKIO 32, Aguardando Confirmação 29,
  Enviar documentos 24, FECHADO 24, +1 lotérica 8, além de outras. Ou seja, A é usada como **seguradora + status do funil**.
- O Chrome está **traduzindo a página** (aparecem `<font>` aninhados nas prévias). O título do contato não foi traduzido,
  mas isso é um risco para quem usa o nome como chave (R6).

### 2.3 Restrição técnica central
**Uma extensão do Chrome não consegue ler o `chrome.storage.local` de outra.** Content scripts de
extensões diferentes rodam em "mundos isolados" e também não compartilham variáveis.
O que a extensão B consegue ver sem ajuda de A: apenas os chips que A desenha no DOM
(`[data-etq="strip"]`) — ou seja, só os clientes **visíveis na tela**, o que não serve para busca.

Portanto, para "se relacionar com as etiquetas já prontas", existem estes caminhos:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **B. Busca dentro de A** (recomendada, revisão 2) | Módulo novo e isolado (`search/`) dentro de A → A v1.1.0, atualizada **na mesma pasta**. | Uma instalação; um storage; zero protocolo entre extensões; só o dono do dado lê o dado; um MutationObserver em vez de dois. | Mexe no código de A (autoria/permissão do Gleidston a confirmar). |
| A. Ponte mínima em A + extensão B | A passa a enviar `{library, assignments}` para B (`chrome.runtime.sendMessage(ID_B, …)`, ou evento DOM entre content scripts). B tem `key` fixa; **A não pode ganhar `key`** (ver R5). | B independente; pode ser desligada sem tocar em A. | **Também mexe em A**, e ainda soma: 2 instalações por atendente, protocolo para versionar, compatibilidade de versões A×B, cópia duplicada dos dados em B. |
| C. Importar JSON | B importa o arquivo exportado por A. | Zero mudança em A. | Dados ficam velhos; passo manual frequente. Inviável no dia a dia. |
| D. Só DOM | B lê os chips desenhados por A. | Zero mudança em A. | Só enxerga o que está na tela. Não resolve o problema. |

**Conclusão (revisão 2):** a única vantagem real de uma extensão separada, que é não mexer em A, **não existe**
em nenhuma opção que funcione no dia a dia. Por isso a separação só traria custos. Ela passa a valer a pena só se
(i) o Gleidston continuar lançando versões de A que vocês precisam receber sem conflito, ou
(ii) não houver permissão para alterar A. Nos dois casos, o caminho certo seria pedir a ele uma API oficial em A.

> Correção da revisão 1: eu tinha recomendado "fixar IDs com `key` no manifest de ambas". **Isso apagaria as
> etiquetas de A**, porque o `chrome.storage` fica preso ao ID e adicionar `key` muda o ID (ver R5).

---

## 3. Spec — Etiquetas ChatClinic v1.1.0 (fechada em 2026-11-23)

**Onde:** módulo isolado (`search/`) dentro da extensão A. Não haverá uma segunda extensão.

**Filtro na própria lista**
- Uma barra de etiquetas fica acima da lista de conversas, junto de `#userSearch` ("Procure aqui..."), com o visual roxo de A.
- Ao escolher 1 ou mais etiquetas, a lista **esconde** os itens `div.conversation` que não têm a etiqueta.
  O clique abre a conversa pelo mecanismo nativo (`chamarChatAtendimento`). Não há painel separado.
- Modo com 2 ou mais etiquetas: **"qualquer uma"** por padrão, com um botão ao lado para trocar para **"todas"**.
- A ordem é a do próprio ChatClinic.
- Clientes etiquetados que não estão na lista carregada **não aparecem**. A busca não tenta abrir conversas fora da lista.
- O filtro vale para as abas (Atendimento/Espera) e para os itens que chegam depois (MutationObserver).
  **Ao recarregar a página, ele recomeça limpo.**
- Fica **fora da V1:** contador por etiqueta, idade da marcação, texto no nome (a busca nativa já faz isso) e ordenação própria.

**Dados**
- O filtro usa só as etiquetas de A, que são pessoais e ficam no navegador. As nativas do ChatClinic (`data-etiq`) ficam fora.
- **A busca é só leitura.** Marcar e desmarcar continua no botão 🏷 da conversa.
- **Chave nome + ID (D8):** A passa a gravar o `data-id` do contato junto com o nome. A migração é compatível:
  as marcações antigas continuam pelo nome e ganham o ID na primeira vez que o contato aparecer na tela.
  O telefone não é gravado.

**Proteção contra perda de etiquetas** (nova permissão: `downloads`)
- **Backup automático:** na primeira abertura do ChatClinic no dia, A salva
  `Downloads/etiquetas-chatclinic-backups/backup-AAAA-MM-DD.json` e mantém só os últimos 7.
  (Mudado de `Downloads/etiquetas-chatclinic/`, que é a **pasta onde a extensão está instalada**: backups e código
  ficariam misturados e apagar a pasta levaria os dois. Não faz backup de dados vazios.)
- **Restaurar:** se A abrir vazia depois de já ter sido usada, aparece um aviso no popup e no ChatClinic com o botão
  "Restaurar backup", que abre a janela para escolher o arquivo.

**Distribuição:** manual nas mais de 10 máquinas. Cada atualização substitui os arquivos **na mesma pasta** e clica em
"Recarregar" (ver R5), com um LEIA-ME de atualização.

**A verificar na implementação** (fatos que eu levanto, sem decisão sua):
- Como o filtro convive com `pesquisa_atendimentos()`, que também esconde e mostra itens.
- Se as outras abas da lista existem no DOM ao mesmo tempo.
- Se `chrome.downloads.removeFile` consegue apagar backups antigos quando o histórico de downloads foi limpo.

### 3.1 Estrutura do repositório
```
busca-etiquetas/
  plan.md
  extension/   → cópia versionada de A (1º commit = v1.0.1 original; mudanças = commits seguintes)
    search/    → módulo novo da busca (filtro, lógica pura testável)
  tests/       → testes unitários da lógica de filtro, migração e rotação de backup (Node, sem dependências)
```
O código instalado (`Downloads/etiquetas-chatclinic/`) **só muda quando você copiar os arquivos para lá.**

### 3.2 Comandos
```
Testes:   powershell -ExecutionPolicy Bypass -File tests\run.ps1
          (roda tests/run.html no Chrome headless; não precisa de Node. Testes de lógica pura também
           rodam com `node --test tests/` se o Node for instalado; os de DOM só no navegador.)
Instalar: Exportar → copiar extension/* por cima de Downloads/etiquetas-chatclinic/ → chrome://extensions → Recarregar → conferir
```

---

## 4. Limites (Boundaries)
- **Sempre:** manter a busca somente leitura; tratar nomes como texto (nunca `innerHTML`);
  não enviar dados de clientes para fora do navegador; testes da lógica de filtro antes de cada commit;
  migração de dados sempre compatível (nada que apague `assignments` existentes).
- **Perguntar antes:** alterações em A fora do escopo da §3; adicionar dependências/build; novas permissões além de `downloads`.
- **Git:** commits e PRs **sem nenhuma atribuição de IA**: sem `Co-Authored-By`, sem "Generated with…" e sem
  identidade do Claude como autor. Autor = identidade git do usuário (já configurada: `Arthur`).
- **Nunca:** gravar no storage de A sem acordo; mandar dados para servidores externos; publicar na Chrome Web Store sem decisão explícita.

---

## 5. Riscos
- R1 — DOM do ChatClinic muda → seletores frágeis (A já sofre disso; isolar seletores em `CONFIG`).
- R2 — Lista de conversas do ChatClinic pode ser virtualizada/paginada → "abrir conversa" pode exigir a busca nativa.
- R3 — Nome como chave: renomear contato no ChatClinic "perde" as etiquetas (herdado de A).
- R4 — IDs de extensões sem compactação mudam por máquina (o ID vem do caminho da pasta).
- **R5 — Perda de dados na atualização de A.** O `chrome.storage.local` fica preso ao ID da extensão. Os dados se perdem se:
  (a) a extensão for **removida** e carregada de novo, (b) a pasta mudar de caminho, ou (c) for adicionada uma `key` ao manifest.
  Mitigação obrigatória: **Exportar** antes; atualizar substituindo os arquivos **na mesma pasta** e clicar em "Recarregar";
  conferir; se o ID mudar, **Importar**. Isso vale para qualquer opção que mexa em A.
- R6 — A tradução automática do Chrome ou nomes repetidos podem descasar a chave por nome. Mitigação: passar a gravar também o
  `data-id` do contato, sem perder a chave por nome (migração compatível).
- ~~R7~~ — Cliente fora da lista carregada: **resolvido por escopo**, porque ele simplesmente não aparece no filtro.
- R8 — A busca nativa (`pesquisa_atendimentos`) e o filtro de etiquetas brigam pela visibilidade dos itens. Mitigação: esconder
  com uma classe própria (`display:none !important`), independente do `style` que a busca nativa altera.
- R9 — Backup diário com nomes de clientes fica em Downloads. Ele é local, mas é visível para quem usa a máquina. A rotação de 7
  arquivos depende do histórico de downloads do Chrome.

---

## 6. Decisões abertas / pendências
Todas fechadas no grill-me de 2026-11-23 (ver §7). Nenhuma pendente.

## 7. Log de decisões
| # | Decisão | Data |
|---|---|---|
| D7 | Busca **pessoal**, só sobre as etiquetas de A. As nativas do ChatClinic ficam fora. | 2026-11-23 |
| D1 | **Módulo dentro de A (v1.1.0).** A é de vocês, e o Gleidston não lança mais versões. | 2026-11-23 |
| — | Uso principal: **rotina diária** de acompanhamento. | 2026-11-23 |
| D8 | A grava **nome + `data-id`** do contato, com migração compatível. Sem telefone. | 2026-11-23 |
| D2 | A busca é **só leitura**. | 2026-11-23 |
| D6 | Distribuição **manual, na mesma pasta**, em mais de 10 máquinas, com LEIA-ME de atualização. | 2026-11-23 |
| D3 | **Filtro na própria lista** do ChatClinic, com uma barra junto de "Procure aqui...". Sem painel nem popup. | 2026-11-23 |
| D5 | Clientes fora da lista carregada **não aparecem**. O clique usa o mecanismo nativo. | 2026-11-23 |
| D4 | V1: **várias etiquetas**, modo padrão **"qualquer uma"** (com troca para "todas"). Sem contador, idade da marcação nem texto. | 2026-11-23 |
| — | Ordem: a do ChatClinic (consequência de D3; a escolha "mais recente primeiro" deixou de valer). | 2026-11-23 |
| — | O filtro **recomeça limpo** ao recarregar a página. | 2026-11-23 |
| D9 | **Backup automático** 1x/dia em Downloads, guardando os últimos 7 (permissão `downloads`). | 2026-11-23 |
| D10 | Aviso **"Restaurar backup"** quando A abrir vazia depois de já ter sido usada. | 2026-11-23 |
| D11 | Código de A **versionado neste repositório** (`extension/`). A pasta instalada só muda por cópia manual. | 2026-11-23 |
| D12 | **T1 descartado:** o filtro pelo nome já atende; não gravar `data-id`. R3/R6 seguem como limitação conhecida. | 2026-11-23 |
| D13 | Backups em `Downloads/etiquetas-chatclinic-backups/` (não na pasta da extensão). | 2026-11-23 |
| D14 | **T7:** ocultar chips nativos (canal/departamento/atendente) por interruptor, só CSS, por atendente. | 2026-11-23 |

---

## 8. Próximas fases
1. ~~Fechar spec (§3)~~ — feito em 2026-11-23.
2. Tarefas verticais:
   - [x] **T0** copiar A v1.0.1 para `extension/` + commit (`a5d898f`).
   - [x] **T2 + T3** barra de filtro (`extension/search/core.js` = lógica pura; `search/bar.js` = DOM): 1 ou mais etiquetas,
     "qualquer uma"/"todas", "limpar", itens novos via MutationObserver, lista recriada, convivência com a busca nativa
     (classe `etq-search-hide` com `!important`), só leitura. 20 testes (lógica + DOM sobre réplica da lista).
     **Falta verificar ao vivo no ChatClinic:** posição da barra (hoje antes de `ul#atendimentos_contatos`; ajuste em
     `CONFIG`), se `.conversation__name--title` dá o nome exato que A usa como chave, e se as abas Atendimento/Espera
     coexistem no DOM.
     Extra fora da spec, para sua revisão: aviso "Nenhuma conversa carregada na lista tem essa etiqueta" quando o filtro
     zera a lista (evita achar que quebrou, por causa de D5).
   - [~] **T1 — descartado (D12).** ~~gravar `data-id` (migração compatível + testes).~~ Depende de saber, ao vivo, onde está o `data-id` da conversa
     **aberta** (o cabeçalho que A usa não tem o atributo; candidato: item ativo na lista).
   - [x] **Barra compacta** (`991ba95`): uma linha + "+N", texto escuro nas não escolhidas. Conferida ao vivo.
   - [x] **T4** backup diário (`background.js` + `protect/core.js`, permissão `downloads`): 1x/dia ao abrir o ChatClinic,
     nunca de dados vazios, rotação de 7 dias pelo histórico de downloads (repetidas do mesmo dia só saem do histórico,
     para não apagar o arquivo novo pelo caminho igual).
   - [x] **T5** aviso "Restaurar backup" (`protect/guard.js` no ChatClinic + cartão no gerenciador). "Vazia" = só etiquetas
     padrão e nenhuma marcação. Sinal de uso anterior: marca no `localStorage` da página do ChatClinic (sobrevive à perda do
     storage da extensão) ou backups no histórico de downloads. "Agora não" dispensa até voltar a ter dados.
   - [x] **Correção: tremor no 1º cliente** (2026-11-23). Causa: ao clicar em "Recarregar" com o ChatClinic aberto, o
     script antigo fica **órfão** (`runtime.id` some) mas segue observando a página; dois `bar.js` brigavam pela posição
     da barra (~13 remoções/recolocações por segundo, 2 barras), empurrando o 1º item. Correção: script órfão se desliga
     e remove a própria barra; o novo remove barras alheias. O `content.js` (A) tinha o mesmo problema latente (faixas do
     órfão com cliques mortos): agora cada cópia tem identidade na assinatura da faixa e a órfã para. Teste
     `tests/orphan.html` falha no código anterior e passa no novo.
   - [x] **T6** v1.1.0: `manifest.json` 1.1.0; `extension/LEIA-ME.txt` reescrito (ATUALIZAR na mesma pasta com Exportar antes,
     Recarregar + F5; INSTALAR; COMO USAR; backup automático). Pacote: `dist/etiquetas-chatclinic-v1.1.0.zip`
     (fora do git; pasta `etiquetas-chatclinic/` dentro).
   - [x] **v1.1.1 — etiquetas piscando ao chegar mensagem** (2026-11-23, medido ao vivo): o ChatClinic recria **a lista
     inteira** (201 itens removidos e recriados de uma vez); as 72 faixas sumiam por ~360 ms (espera de 200 ms do
     `content.js`) e, com filtro ativo, a lista toda aparecia por ~150 ms. Correção: quando chegam itens novos na lista,
     `content.js` e `bar.js` redesenham dentro do MutationObserver (antes da tela ser pintada). Custo medido do render
     do `content.js`: 14–34 ms (6,2 mil textos), uma vez por troca; demais mudanças seguem com espera. Teste
     `tests/refresh.html` (falha no código anterior).
   - [x] **T7 (pedido em 2026-11-23)** opção para **ocultar as etiquetas nativas do ChatClinic** na lista.
     Seletores (estudo ao vivo, 2026-11-23), dentro de `div.conversation__details > div.departamentos-atendimento`:
     canal "Protege - Oficial" = `span#marc-canal` (laranja); departamento "Conhecer Seguros" = `span#marc-depart:not(.marc-atendente)`
     (amarelo); atendente "Arthur Santos" = `span#marc-depart.marc-atendente` (azul). Na mesma linha há `span#expira_tem…`
     (não esconder a linha inteira). As bolinhas "M"/"E" são `span#tria-origem` em `.conversation__message` (fora do escopo).
     Feito: `native/core.js` (gera o CSS) + `native/hide.js` (aplica na página) + cartão "Etiquetas do ChatClinic" no
     gerenciador com 3 interruptores, guardados em `hideNative` no storage. Só CSS, só dentro de `#atendimentos_contatos`,
     nunca a linha inteira. Testes em `tests/native.html`.
3. Implementar incrementalmente, com teste por fatia.
