# Caveman — origem dos arquivos

- Repositório: https://github.com/JuliusBrussee/caveman
- Commit: b89752f6bca5a26bfde8b019813554241800ca99 (2026-11-23)
- Licença: Apache-2.0 (ver LICENSE e NOTICE nesta pasta)

## Copiado
Skills: caveman, ultracave, megacave, caveman-commit, caveman-review, caveman-help, caveman-explore,
caveman-compress, cavecrew, investigate-first, lean-build, migration, safe-refactor, surgical-patch, verify-and-stop.
Agentes (.claude/agents): cavecrew-builder, cavecrew-investigator, cavecrew-reviewer.

## Modificado
- lean-build/: adicionado native-core.md (de skills/native/native-core.md) + 1 linha no SKILL.md apontando para ele.

## Não copiado (dependem do Caveman CLI / Caveman Cloud)
caveman-setup, caveman-discover, caveman-evidence-review, caveman-learn, caveman-manage, caveman-optimize, caveman-stats.
O instalador (npx @caveman-ai/cli) não foi executado: ele altera a configuração global de todos os agentes da máquina.

## Atenção
- caveman-compress envia o texto do arquivo ao provedor de modelo configurado (claude CLI, API Anthropic etc.).
- caveman-commit já proíbe atribuição de IA nos commits, o que está de acordo com a regra do projeto.
