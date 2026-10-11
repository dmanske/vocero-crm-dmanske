#!/bin/sh
# ¿El proyecto de donde este repositorio recibe actualizaciones (remoto
# `upstream`) tiene cambios que todavía no se trajeron? ¿Quedan textos sin
# traducir? En el fork pt-BR, `upstream` es kevinrivm/vocero-crm; en un
# proyecto derivado del fork (p. ej. vocero-salao), es el fork pt-BR.
#
# Lo corre el hook de inicio de sesión de Kiro (.kiro/hooks/) y se puede correr
# a mano:  sh idiomas/verificar-atualizacao.sh
#
# Solo LEE: hace `git fetch` de upstream y compara. Nunca mezcla ni empuja.
# Sin red o sin el remoto `upstream`, no dice nada y sale con 0.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
url=$(git remote get-url upstream 2>/dev/null) || exit 0
origen=$(echo "$url" | sed -E 's#^.*github\.com[:/]##; s#\.git$##')

GIT_TERMINAL_PROMPT=0 git fetch --quiet upstream main 2>/dev/null || exit 0

novos=$(git rev-list --count HEAD..upstream/main 2>/dev/null || echo 0)
pendentes=$(node idiomas/revisar.mjs 2>/dev/null | tail -1)

if [ "$novos" -gt 0 ]; then
  echo "[atualização] O projeto de origem ($origen) tem $novos commit(s) novo(s) que este repositório ainda não trouxe:"
  git log --oneline --no-merges HEAD..upstream/main | head -15 | sed 's/^/  /'
  echo "Avise o usuário e proponha a atualização seguindo .kiro/steering/fork-pt-br.md (seção «Quando chegar atualização»). Não faça merge sem o ok dele."
fi
if [ -n "$pendentes" ]; then
  echo "[pt-BR] Traduções: $pendentes"
fi
exit 0
