# Maestro

[![versão npm](https://img.shields.io/npm/v/@alissonpokry/maestro.svg)](https://www.npmjs.com/package/@alissonpokry/maestro)
[![pacote npm](https://img.shields.io/badge/npm-@alissonpokry%2Fmaestro-red.svg)](https://www.npmjs.com/package/@alissonpokry/maestro)
[![Licença: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Gerenciador dinâmico de bundles de skills para assistentes de programação com IA.

[English](README.md)

O Maestro ajuda agentes a carregar as instruções certas para a tarefa atual. Em vez de manter regras de todas as linguagens, frameworks e fluxos de trabalho no prompt ativo, o Maestro roteia a solicitação para um bundle focado de skills e mantém menor o contexto do agente.

## Instalação

Instale o pacote diretamente pelo npm:

```bash
npm i @alissonpokry/maestro
```

Depois execute o instalador:

```bash
npx @alissonpokry/maestro
```

## Pacote

| Campo | Valor |
| --- | --- |
| Pacote | `@alissonpokry/maestro` |
| Versão atual | `1.0.3` |
| Instalação npm | `npm i @alissonpokry/maestro` |
| Uso com npx | `npx @alissonpokry/maestro` |
| Binário da CLI | `maestro` |
| Licença | MIT |
| Dependências de runtime | Nenhuma |
| Node.js | `>=18` |

## O Que o Maestro Faz

- Instala skills de comandos slash para Cursor, Claude, Antigravity/Gemini e Codex/Agents.
- Salva um caminho ativo de `skill-bundle-folder` para o Maestro.
- Escaneia pastas de bundles e cria um índice compacto de `Known Bundles`.
- Roteia solicitações `/maestro` para o bundle e os arquivos de skill mais relevantes.
- Fornece comandos de manutenção para trocar pastas, atualizar o índice e verificar a configuração atual.

## Início Rápido

1. Instale o Maestro no seu projeto ou na pasta de usuário, como indicado na seção de instalação acima.

2. Defina sua pasta de bundles de skills:

```text
/maestro-set C:\Users\user\Desktop\My-Skill-Bundles
```

3. Roteie uma tarefa pelo Maestro:

```text
/maestro Build a login page in Angular.
```

O Maestro verifica a solicitação, seleciona o bundle mais relevante, lê apenas as instruções das skills correspondentes e continua a tarefa com contexto focado.

## Opções do Instalador

O instalador pergunta:

- Ação: instalação ou desinstalação.
- Escopo: projeto local ou pasta global do usuário.
- Ambiente de IA: Cursor, Claude, Antigravity/Gemini, Codex/Agents ou todos os ambientes suportados.

Instalações locais colocam os arquivos do Maestro no projeto atual. Instalações globais colocam os arquivos nas pastas de usuário correspondentes de cada assistente.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `/maestro <task>` | Roteia uma tarefa pelo bundle mais relevante. |
| `/maestro-set <folder-path>` | Salva ou troca o `skill-bundle-folder` ativo. |
| `/maestro-fetch [folder-path]` | Atualiza o índice de `Known Bundles`. |
| `/maestro-stats` | Mostra a pasta ativa de bundles e os bundles indexados. |

Se seu agente expuser apenas `/maestro`, use estes aliases:

| Alias | Comando equivalente |
| --- | --- |
| `/maestro switch <folder-path>` | `/maestro-set <folder-path>` |
| `/maestro fetch [folder-path]` | `/maestro-fetch [folder-path]` |
| `/maestro stats` | `/maestro-stats` |

## Estrutura dos Bundles de Skills

O Maestro espera uma pasta cujos filhos diretos sejam bundles. Cada bundle pode conter uma ou mais skills, e cada skill é representada por um arquivo `SKILL.md`.

```text
My-Skill-Bundles/
|
+-- Angular-pro/
|   +-- angular-architecture/
|   |   +-- SKILL.md
|   +-- angular-ui-patterns/
|       +-- SKILL.md
|
+-- Python-pro/
|   +-- python-testing/
|       +-- SKILL.md
|
+-- Seo-pro/
    +-- seo-audit/
        +-- SKILL.md
```

Na terminologia do Maestro:

- `skill-bundle-folder` é a pasta que contém todos os bundles.
- `bundle` é uma pasta filha direta, como `Angular-pro`.
- `skill` é um `SKILL.md` específico dentro de um bundle.

## Ambientes Suportados

O Maestro pode instalar arquivos de comando e skill para:

- Cursor
- Claude
- Antigravity/Gemini
- Codex/Agents

## Desenvolvimento no Repositório

Este pacote não tem dependências de runtime. O ponto de entrada da CLI é:

```bash
bin/cli.js
```

Comandos úteis para desenvolvimento local:

```bash
node bin/cli.js init
node bin/cli.js uninstall
npm test
npm run pack:dry-run
```

## Licença

MIT. Veja [LICENSE](LICENSE).
