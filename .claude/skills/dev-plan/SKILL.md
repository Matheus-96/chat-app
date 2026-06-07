---
name: dev-plan
description: Creates a structured development plan from the current conversation context or an attached PRD. Records immutable architectural decisions and organizes tasks using the tracer bullet methodology — each task is a thin vertical slice that proves the system works before expanding scope.
---

# Dev Plan

O plano não descreve detalhes de implementação — descreve decisões, critérios de aceite e tasks tracer bullet que permitem ao agente se auto-verificar a qualquer momento.

## Início

### 1. Leia o input
Pergunte: "Há um arquivo de PRD para eu ler, ou baseio-me na conversa atual?"
Leia tudo antes de continuar.

### 2. Explore o repositório
Antes de entrevistar o usuário, entenda o terreno:
- Mapeie as camadas relevantes ao requisito (rotas, services, repositórios, componentes)
- Identifique padrões existentes que o plano deve seguir
- Sinalize inconsistências ou dívidas técnicas que possam impactar o escopo

### 3. Entreviste o usuário
Com base no input e na exploração, levante todas as ramificações em aberto — decisões, ambiguidades, conflitos com o que já existe. Faça perguntas uma a uma, em ordem de impacto. Não avance para o rascunho enquanto restar qualquer ramificação sem entendimento compartilhado.

Salve o plano em `docs/plans/<feature-slug>.md`.

## Regras inegociáveis

- **ADs são imutáveis**: o agente NÃO contorna uma Decisão Arquitetural. Se surgir conflito, para e reporta ao usuário.
- **Task 1 é a tracer bullet**: menor caminho E2E possível — prova que as camadas se conectam, não que estão completas.
- **Done-when é lei**: se não é verificável sem ambiguidade, a task está mal definida.
- **Tasks de teste são explícitas**: mapeie tasks de teste para pontos-chave — services e regras de negócio sempre têm sua task de teste correspondente. Testes não são etapa final; ficam na mesma fase da lógica que cobrem.
- **Fases agrupam por capacidade entregável, não por camada técnica**: cada fase completa uma ou mais histórias de usuário ou valida um risco. Dentro de cada fase, cada task continua sendo um corte vertical (E2E). Estime o total de tasks primeiro, depois agrupe as que, juntas, entregam algo demonstrável ao usuário.

| Total de tasks | Fases |
|----------------|-------|
| 1–3            | 1     |
| 4–7            | 2     |
| 8–12           | 3     |
| 13+            | 4+    |

## Template do plano

```markdown
# Plano: [Nome da Feature]

> **Status:** Rascunho | Em andamento | Concluído
> **Criado em:** YYYY-MM-DD
> **Origem:** [link para PRD/issue ou "Conversa em YYYY-MM-DD"]

## 1. O que estamos construindo

[2–4 frases. Qual problema resolve e por quê agora.]

## 2. Fora do escopo

- [Item explícito que não entra]

## 3. Decisões Arquiteturais

| # | Decisão | Rationale | Consequência |
|---|---------|-----------|--------------|
| AD-1 | ... | ... | ... |

## 4. Requisitos

- RF-1: [O sistema deve...]
- RNF-1: [Performance, segurança, acessibilidade...]

## 5. Critérios de Aceite Globais

- [ ] [Critério testável]
- [ ] Build sem erros, testes passando

## 6. Tasks

### Fase 1: [Nome — Tracer Bullet]
> Entrega: [o que funciona ao final desta fase]

#### Task 1: [Nome]
- **Prova:** [qual hipótese de integração esta task valida]
- **Done-when:**
  - [ ] [condição verificável]
- **Verificar:** `[comando ou passo manual]`
- **Balizador:** Se [estado esperado do sistema ao terminar], está no caminho certo.

#### Task 2: [Nome]
[mesma estrutura]

#### Task 2T: Testes — [Nome do service ou regra coberta]
- **Cobre:** [service / regra de negócio introduzida na task anterior]
- **Done-when:**
  - [ ] Casos feliz e de erro do service testados
  - [ ] Regras de negócio críticas têm assertion explícita
- **Verificar:** `[comando para rodar os testes]`

---
**Checkpoint Fase 1:** build limpo + verificação manual do fluxo principal + aprovação para continuar.

---

### Fase N: [Nome — Expansão]
> Entrega: [o que funciona ao final desta fase]

[tasks com mesma estrutura]

---
**Checkpoint Fase N:** build limpo + todos os critérios de aceite globais atendidos.

## 7. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|

## 8. Perguntas em aberto

- [ ] [Pergunta que precisa de resposta humana]
```

## Após rascunhar

Apresente o plano e pergunte: "Está correto o escopo? Há decisões arquiteturais a adicionar ou corrigir?"
Aplique correções, salve o arquivo. Opcionalmente sugira `/to-issues` para converter tasks em tickets.