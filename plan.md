# plan.md — Busca por Etiquetas (ChatClinic)

> Documento vivo. Segue o fluxo *spec-driven* (Especificar → Planejar → Tarefas → Implementar),
> com uma porta de revisão humana entre cada fase. **Fase atual: ESPECIFICAR (grill-me em andamento).**
> Nenhum código será escrito antes das decisões abertas (§6) serem fechadas.

---

## 1. Objetivo

Criar a função **"Busca por Etiquetas"**, seja como segunda extensão ou como módulo da extensão existente
(decisão D1; a recomendação atual é módulo), que permita ao atendente
**encontrar clientes pelas etiquetas** que ele já marcou com a extensão existente
**Etiquetas ChatClinic**, usando as mesmas etiquetas e as mesmas marcações de cada pessoa
(sem recriar nada).

Exemplo de uso: "me mostre todos os clientes com a etiqueta *Retornar ligação*" → lista de nomes
→ clico num nome → a conversa abre no ChatClinic.

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

## 3. Proposta (rascunho — depende do grill-me)

- **Extensão B "Busca por Etiquetas"** (MV3), content script em `app.chatclinic.com.br`.
- Botão/painel "🔎 Buscar por etiqueta" dentro do ChatClinic (Shadow DOM, mesmo visual roxo de A).
- Filtros: escolher 1+ etiquetas (modo **todas** / **qualquer uma**), texto no nome, idade da marcação.
- Resultado: lista de clientes com chips + "marcada em dd/mm às hh:mm", ordenada pela marcação mais recente.
- Clicar num cliente → abrir a conversa no ChatClinic (mecanismo depende de P1: usar a busca nativa
  do ChatClinic ou clicar no item da lista; *fallback*: copiar o nome).
- Somente leitura sobre os dados de A (B não marca/desmarca — isso continua em A). *A confirmar.*

### 3.1 Estrutura prevista do repositório
```
busca-etiquetas/
  plan.md
  extension/            → extensão B (manifest.json, background.js, content.js, search/*.js, icons/)
  patches/etiquetas-chatclinic/  → mudança mínima proposta para A (se Opção A)
  tests/                → testes unitários da lógica de filtro (Node, sem dependências)
```

### 3.2 Comandos (previstos)
```
Testes:   node --test tests/
Carregar: chrome://extensions → Modo do desenvolvedor → Carregar sem compactação → pasta extension/
```

---

## 4. Limites (Boundaries)
- **Sempre:** manter B somente-leitura sobre os dados de A; tratar nomes como texto (nunca `innerHTML`);
  não enviar dados de clientes para fora do navegador; testes da lógica de filtro antes de cada commit.
- **Perguntar antes:** qualquer alteração na extensão A; adicionar dependências/build; novas permissões.
- **Git:** commits e PRs **sem nenhuma atribuição de IA**: sem `Co-Authored-By`, sem "Generated with…" e sem
  identidade do Claude como autor. Autor = identidade git do usuário. *(Hoje `user.name`/`user.email` não estão
  configurados nesta máquina, então é preciso configurar antes do primeiro commit.)*
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

---

## 6. Decisões abertas / pendências
- **P1 (fato, meu)** — Estudar ao vivo o DOM do ChatClinic (campo de busca, lista, virtualização).
  Bloqueado: Claude in Chrome desconectado.
- **D1–D6** — a decidir no grill-me (será feito numa nova conversa, com as skills carregadas).
  Perguntas já identificadas, com a recomendação atual:
  - D1 Integração com A: **Opção B (busca como módulo dentro de A, v1.1.0)**, desde que haja permissão para
    alterar A e ninguém mais publique versões dela. Fatos que podem mudar isso: quem mantém A hoje; se há
    autorização do autor; quantos atendentes/máquinas usam A.
  - D2 B é somente leitura (marcar/desmarcar continua em A).
  - D3 Interface: painel dentro do ChatClinic; ícone da extensão como atalho.
  - D4 Filtros V1: várias etiquetas (todas/qualquer), texto no nome, idade da marcação.
  - D5 Clicar no resultado abre a conversa; *fallback*: copiar o nome (depende de P1).
  - D6 Distribuição: .zip sem compactação + LEIA-ME, fora da Chrome Web Store.

## 7. Log de decisões
| # | Decisão | Data |
|---|---|---|
| — | (vazio) | |

---

## 8. Próximas fases (após o grill-me)
1. Fechar spec (§3 definitivo) → revisão sua.
2. Quebrar em tarefas verticais (ex.: T1 ponte A↔B lendo dados; T2 painel com filtro por 1 etiqueta;
   T3 filtros combinados; T4 abrir conversa; T5 empacotamento/instalação) → revisão sua.
3. Implementar incrementalmente, com teste por fatia.
