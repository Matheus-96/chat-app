# Tracer Bullet — Metodologia

## O conceito

Uma "bala traçante" é uma rodada de munição que deixa um rastro luminoso para que o atirador possa
ver onde está mirando e corrigir em tempo real — sem precisar recalcular tudo do zero.

Em software: a **Task 1 (tracer bullet)** é o menor caminho que atravessa todas as camadas do sistema.
Não é um protótipo descartável. É código de produção, mínimo e funcional, que prova que as camadas
se integram. Tudo que vem depois é expansão.

## Por que isso é um balizador

Sem tracer bullet, o agente pode passar horas construindo uma camada perfeita que não se integra com a
próxima. Com tracer bullet:

- A integração é provada **cedo**, quando é barato corrigir
- Cada task seguinte tem uma base estável para expandir
- O agente pode parar a qualquer momento e o sistema ainda funciona
- Erros de direção são detectados na Task 1, não na Task 7

## Estrutura de fases

```
Task 1: Tracer bullet
  └── O menor caminho E2E funcional
  └── Todas as camadas tocadas, nenhuma completa

Task 2–N: Expansão vertical
  └── Adiciona casos de uso ao tracer
  └── Cada task deixa o sistema em estado funcional
  └── Nunca "quebra" para reconstruir

Checkpoint (a cada 3–4 tasks)
  └── Build limpo
  └── Testes passando
  └── Demo/verificação manual do fluxo principal
```

## O que NÃO é tracer bullet

- ❌ Construir todo o banco de dados antes de qualquer API
- ❌ Construir toda a API antes de qualquer UI
- ❌ "Fase de arquitetura" seguida de "fase de implementação"
- ❌ Tasks que terminam com o sistema quebrado esperando a próxima task

## Exemplo concreto

**Feature**: Usuário pode fazer upload de imagem e vê thumbnail

**Errado (horizontal):**
```
Task 1: Schema e migration para imagens
Task 2: Todos os endpoints de imagem
Task 3: Toda a UI de upload
Task 4: Conectar tudo
```
→ O sistema só funciona na Task 4. Se a Task 3 revelar que o design da API está errado, retrabalho enorme.

**Certo (tracer bullet):**
```
Task 1 (tracer): Upload de um arquivo → salva no disco → retorna URL → UI exibe a URL como texto
  Done-when: enviar um arquivo via curl retorna 200 com a URL, a UI lista essa URL
  Balizador: se você consegue ver a URL na tela após o upload, está no caminho certo

Task 2: Gerar thumbnail no servidor ao receber o upload
  Done-when: a URL retornada aponta para o thumbnail, não o original

Task 3: UI exibe o thumbnail como <img> com fallback de loading
  Done-when: o thumbnail é visível na UI sem recarregar a página

Task 4: Validação de tipo e tamanho de arquivo
  Done-when: arquivos inválidos retornam 422 com mensagem amigável na UI
```
→ Após Task 1, o sistema já funciona (mesmo que feio). Cada task seguinte melhora um aspecto.

## Decisões Arquiteturais como balizadores

As decisões no Seção 3 do plano têm um papel diferente dos done-when das tasks.

- **Done-when**: verifica se esta task específica está concluída
- **Decisão Arquitetural (AD)**: verifica se o agente está no caminho correto no nível do sistema

Exemplos de bons ADs:
- "Toda comunicação entre frontend e backend usa REST sobre `/api/v1`" (AD sobre protocolo)
- "Autenticação é sempre verificada no middleware, nunca no controller" (AD sobre segurança)
- "Nenhuma lógica de negócio reside no frontend" (AD sobre separação de responsabilidades)

Um AD é violado quando o agente faz uma escolha que contradiz a decisão. O agente deve detectar
isso sozinho lendo o plano antes de cada task — e parar se houver conflito.
