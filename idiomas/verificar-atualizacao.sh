#!/bin/sh
# Fork pt-BR — ¿el original (kevinrivm/vocero-crm) tiene cambios que este
# repositorio todavía no trajo? ¿Quedan textos sin traducir?
#
# Lo corre el hook de inicio de sesión de Kiro (.kiro/hooks/) y se puede correr
# a mano:  sh idiomas/verificar-atualizacao.sh
#
# Solo LEE: hace `git fetch` del original y compara. Nunca mezcla ni empuja.
# Sin red o sin el remoto `upstream`, no dice nada y sale con 0.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
git remote get-url upstream >/dev/null 2>&1 || exit 0

GIT_TERMINAL_PROMPT=0 git fetch --quiet upstream main 2>/dev/null || exit 0

novos=$(git rev-list --count HEAD..upstream/main 2>/dev/null || echo 0)
pendentes=$(node idiomas/revisar.mjs 2>/dev/null | tail -1)

if [ "$novos" -gt 0 ]; then
  echo "[fork pt-BR] O projeto original (kevinrivm/vocero-crm) tem $novos commit(s) novo(s) que este repositório ainda não trouxe:"
  git log --oneline --no-merges HEAD..upstream/main | head -15 | sed 's/^/  /'
  echo "Avise o usuário e proponha a atualização seguindo .kiro/steering/fork-pt-br.md (seção «Quando o Kevin atualizar»). Não faça merge sem o ok dele."
fi
if [ -n "$pendentes" ]; then
  echo "[fork pt-BR] Traduções: $pendentes"
fi
exit 0
