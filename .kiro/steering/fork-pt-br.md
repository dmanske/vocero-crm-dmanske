---
inclusion: always
---

# Fork pt-BR do Vocero CRM

O fork pt-BR (`dmanske/vocero-crm-dmanske`) vem de `kevinrivm/vocero-crm`.
Objetivo: o sistema inteiro em português do Brasil **sem mexer no código do
original**, para que as atualizações do Kevin entrem sem conflito.

Corrente de atualização (o remoto `upstream` é sempre o nível de cima):

```
kevinrivm/vocero-crm          ← original, em espanhol
  → dmanske/vocero-crm-dmanske  ← só a tradução pt-BR (upstream = Kevin)
    → dmanske/vocero-salao      ← pt-BR + pacote salão (upstream = fork pt-BR)
```

Projetos derivados (como o `vocero-salao`) têm um guia próprio em
`.kiro/steering/` com o que é deles; este arquivo vale para todos.

## Como a tradução funciona

- O código de `src/` continua em espanhol, igual ao original. **Nunca traduza
  textos editando `src/`.**
- A tradução vive em `idiomas/pt-BR/<caminho do arquivo>.json`, um arquivo por
  arquivo de `src/`, no formato `{ "texto em espanhol": "texto em português" }`.
  `null` = revisado, fica como está (texto técnico que parece frase).
- `IDIOMA=pt-BR` (no `.env` ou na plataforma, vale no build) liga a tradução.
  Na compilação, `idiomas/loader.cjs` troca os textos. Sem `IDIOMA`, o sistema é
  o original em espanhol.
- Peças: `idiomas/transformar.cjs` (núcleo), `idiomas/loader.cjs` (webpack),
  `idiomas/next.cjs` (liga no `next.config.ts`, o único arquivo do original
  alterado: 2 linhas), `idiomas/revisar.mjs` (relatório),
  `idiomas/verificar-atualizacao.sh` (aviso de atualização, rodado pelo hook
  `.kiro/hooks/fork-pt-br-atualizacao.json` no início de cada sessão).
- Testes do tradutor: `tests/unit/idiomas-transformar.test.ts`.

## Quando chegar atualização

O hook de início de sessão avisa quando `upstream/main` tem commits novos.
Nesse caso, **avise o usuário e só siga com o ok dele**. Num projeto derivado,
as mudanças do Kevin só chegam depois de entrarem no fork pt-BR: atualize o
fork pt-BR primeiro.

1. `git switch main && git fetch upstream && git merge upstream/main`
   (no fork pt-BR, conflito esperado no máximo em `next.config.ts`: manter as
   duas linhas de `comIdiomas`; num projeto derivado, também nos arquivos que ele alterou).
2. Trazer para a branch de trabalho, se houver (`git merge main`).
3. `node idiomas/revisar.mjs` → lista o que falta (`+`), o que ficou velho
   (`-`, o Kevin mudou ou apagou o texto) e erros.
4. Traduzir os faltantes e atualizar ou remover as chaves velhas, seguindo o glossário.
5. Rodar de novo até `0 textos faltando · 0 traduções desatualizadas · 0 erros`
   (ou só textos marcados conscientemente como pendentes).
6. `pnpm typecheck && pnpm lint && pnpm test`, e o build com `IDIOMA=pt-BR pnpm build`.
7. Conferir na tela as telas que o Kevin mudou. Commit e push só com o ok do usuário.

`node idiomas/revisar.mjs --archivo <trecho>` mostra um arquivo; `--detalle` mostra tudo com a linha.

Código novo escrito direto em português (o de um projeto derivado) não precisa
de dicionário: liste a pasta em `idiomas/<idioma>/.ignorar` (um prefixo de
caminho por linha, `#` para comentário) e o revisor deixa de cobrá-la.

## Regras de tradução

- Português do Brasil natural e curto, tratando por **você**. Nada de português de Portugal.
- Mantenha marcadores `{0}`, `{1}`… (pode mudar a ordem, não pode tirar nem inventar).
- Mantenha nomes de marca e produto: WhatsApp, Meta, Instagram, Messenger, Zoom,
  Google, OpenRouter, Cloud API, Zernio, Vocero.
- Aspas: use “ ” no lugar de « ».
- **Antes de traduzir, olhe a linha no código.** Use `null` quando a cadeia:
  é comparada (`===`, `case`), é chave/identificador, vai para a API ou para o
  banco, é lida por regex, é nome de evento, código de erro, cabeçalho HTTP,
  nome de tecla (`"Escape"`) ou formato de data. Na dúvida, `null` e anote.
- Locale: `"es-MX"` usado em `toLocale…`/`Intl` vira `"pt-BR"`.

## Glossário

| Espanhol | Português |
|---|---|
| Bandeja | Caixa de entrada |
| Pipeline | Funil |
| Etapa | Etapa |
| Lead / prospecto | Lead |
| Trato (deal) | Negociação |
| Negocio (a empresa) | Negócio |
| Contacto | Contato |
| Ficha (do lead) | Ficha |
| Plantilla | Modelo de mensagem (curto: Modelo) |
| Ajustes / Configuración | Configurações |
| Agente | Agente |
| Laboratorio | Laboratório |
| Corrida (do Laboratório) | Execução |
| Juez | Juiz |
| Conocimiento / base de conocimiento | Conhecimento / base de conhecimento |
| Citas / cita | Agendamentos / agendamento |
| Hueco (horário livre) | Horário disponível |
| Escalar / pasar a una persona / handoff | Transferir para uma pessoa / atendimento humano |
| Ventana de 24 h | Janela de 24 h |
| Propietario | Proprietário |
| Equipo | Equipe |
| Marca | Marca |
| Anuncio | Anúncio |
| Conversiones | Conversões |
| Correo | E-mail |
| Contraseña | Senha |
| Iniciar sesión / Cerrar sesión | Entrar / Sair |
| Guardar | Salvar |
| Borrar / Eliminar | Excluir |
| Archivar | Arquivar |
| Enviar | Enviar |
| Ganado / Perdido | Ganho / Perdido |
| Ventas | Vendas |
| Resultados | Resultados |
| Guía de inicio | Primeiros passos |
| Conectar / desconectar | Conectar / desconectar |
| Número de teléfono | Número de telefone |
| Prueba (de conexão) | Teste |
