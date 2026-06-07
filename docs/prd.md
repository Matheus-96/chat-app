# PRD — Chat com Coach de Escrita em Inglês

> Especificação conceitual e de negócio. Para a lista completa de entidades, modelos de dados, protocolo WebSocket, rotas HTTP e requisitos não funcionais, consulte [`requirements.md`](./requirements.md).

## Problem Statement

Praticantes de inglês não têm um ambiente conversacional de baixa fricção onde possam escrever livremente e receber feedback de escrita em tempo real, integrado ao fluxo da conversa. Ferramentas existentes exigem cadastro, são síncronas (correção só após envio de formulário) ou desacopladas do contexto da troca de mensagens.

---

## Solution

Uma sala de chat temporária e sem cadastro onde participantes trocam mensagens em inglês e um coach de IA analisa e corrige a escrita inline, como parte da conversa. O usuário traz sua própria chave de API, controla quando o coach age e personaliza as instruções de correção para seu nível e objetivos.

---

## Épicos e Regras de Negócio

### Épico 1 — Salas Temporárias

**Conceito:** A sala é a unidade central do produto. Ela é temporária por design — não há histórico persistido, não há conta vinculada. O código curto é o identificador humano da sala.

**Regras de negócio:**
- Toda sala possui um código curto de 6 caracteres gerado pelo sistema, usando alfabeto sem caracteres ambíguos (sem `0`, `O`, `I`, `1`).
- O TTL de uma sala é de 24 horas, renovado a cada mensagem enviada e a cada nova conexão (`join_room`).
- Ao expirar, o servidor emite o evento `room_expired` para todos os clientes conectados antes de encerrar a sala.
- Sala expirada não pode ser reentrada — o cliente redireciona para a landing com mensagem clara.
- O tempo restante aproximado é exibido na sidebar para o usuário ter consciência da expiração.

**Decisão técnica — TTL renovado no join:** Isso evita que um usuário que ficou conectado sem escrever perca a sala enquanto outros estavam ativos em outras abas ou dispositivos.

---

### Épico 2 — Identidade sem Cadastro

**Conceito:** O produto não tem autenticação. A identidade é efêmera — existe apenas durante a sessão. Isso é uma decisão de produto deliberada, não uma limitação técnica.

**Regras de negócio:**
- O ID do participante é gerado por aba do navegador via `sessionStorage`. Duas abas do mesmo navegador = dois participantes distintos.
- O nome é livre, sem validação de unicidade.
- A API Key e as custom instructions são armazenadas em `localStorage` e persistem entre sessões no mesmo navegador.
- Nenhum dado de identidade é persistido no servidor — o servidor só conhece o participante enquanto a conexão WebSocket está ativa.

---

### Épico 3 — Chat em Tempo Real

**Conceito:** WebSocket é o canal principal. HTTP serve apenas para criar e consultar salas. Todo estado de conversa — mensagens, participantes, reações, digitação — flui via WebSocket.

**Regras de negócio:**
- Ao conectar, o cliente recebe um `room_snapshot` com o estado completo: mensagens anteriores e participantes ativos.
- Mensagens têm limite de 800 caracteres.
- Rate limit por conexão: configurável via variáveis de ambiente (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`), padrão 10 mensagens por 15 segundos. Exceder retorna evento `error`.
- Todas as mensagens são públicas — não existe mensagem privada nesta versão.
- O indicador de digitação é propagado em tempo real para todos os outros participantes da sala.

**Decisão técnica — Rate limiter isolado:** A lógica de rate limit vive num módulo `RateLimiter` separado, não dentro do handler WebSocket. Os limites são configuráveis por variáveis de ambiente para facilitar ajuste em produção sem deploy de código.

---

### Épico 4 — Reconexão e Resiliência

**Conceito:** Quedas de conexão são previsíveis (deploy, flap de rede, idle timeout do servidor). A experiência de reconexão deve ser transparente para o usuário e nunca deixá-lo numa tela quebrada.

**Regras de negócio:**
- Ao detectar queda, o cliente tenta reconectar com backoff exponencial: 1s → 2s → 4s → 8s… com cap de 30 segundos por tentativa.
- Máximo de ~10 tentativas antes de transicionar para estado `disconnected` com mensagem "não foi possível reconectar".
- Ao reconectar com sucesso, o cliente re-envia `join_room` e recebe novo `room_snapshot` — o estado é restaurado automaticamente.
- Se a sala expirou durante a queda, o servidor responde com `room_expired` e o cliente redireciona para a landing.

**Estados de conexão:** `connected` | `reconnecting` | `disconnected` — visíveis na sidebar e usados pela store para bloquear envio de mensagens enquanto desconectado.

---

### Épico 5 — Coach de IA

**Conceito:** O coach é um participante especial da sala. Ele responde a mensagens com correções, mas não inicia conversas. Sua resposta aparece como uma mensagem separada vinculada à original — não edita a mensagem do usuário.

**Regras de negócio:**
- A API Key do usuário é obrigatória para ativar o coach. Sem ela, o coach fica desabilitado com aviso claro na UI.
- A API Key é enviada junto com cada mensagem/análise — nunca armazenada no servidor.
- As custom instructions são enviadas junto com cada análise — nunca armazenadas no servidor.
- Custom instructions têm limite de 250 caracteres, validado no frontend e no backend.
- O backend deve garantir no system prompt que a IA só aceita instruções relacionadas a escrita de textos — instruções fora desse escopo são ignoradas.
- A correção da IA é sempre pública — todos os participantes da sala veem a correção de todos.
- Em caso de falha da IA (timeout, chave inválida, rate limit do provider), o evento `correction_finished` é emitido com `error: true` e `errorReason`.
- Não há retry automático no servidor. O usuário pode re-disparar manualmente.
- A UI exibe "Análise indisponível" inline, discretamente, sem bloquear o fluxo da conversa.

**Decisão técnica — Interface AIProvider:** A integração com OpenRouter é encapsulada atrás de uma interface `AIProvider`. O use case `AnalyzeMessage` recebe a implementação por injeção de dependência. Isso permite trocar de provider ou mockar nos testes sem alterar lógica de negócio.

**Decisão técnica — `errorReason` tipado:** Os valores possíveis são `'timeout' | 'invalid_key' | 'rate_limited'`. A UI pode exibir mensagens específicas por tipo de erro se necessário no futuro.

---

### Épico 6 — Modo do Agente

**Conceito:** O usuário controla se quer feedback automático em tudo que escreve ou feedback sob demanda. Essa é uma preferência pessoal de aprendizado.

**Regras de negócio:**
- `Automático`: toda mensagem enviada com API Key configurada dispara análise imediatamente após o envio.
- `Manual`: o envio não dispara análise. O usuário clica em "Analisar" na mensagem ou usa `Ctrl+Enter`.
- O modo é por participante, não por sala — cada pessoa configura o seu.
- O toggle fica na sidebar e a preferência persiste na sessão (memória, não localStorage).
- Sem API Key configurada, o toggle de modo não tem efeito — o coach permanece desabilitado.

---

### Épico 7 — Custom Instructions do Coach

**Conceito:** Usuários têm diferentes objetivos de aprendizado. Alguém focado em vocabulário B2 tem necessidades diferentes de quem quer somente correção de erros que mudam o significado. Custom instructions dão essa flexibilidade sem complexidade de modos pré-definidos.

**Regras de negócio:**
- Campo de texto livre com máximo de 250 caracteres.
- Validado no frontend (contador de caracteres, bloqueio de envio) e no backend (Zod, erro 400 se exceder).
- Disponível na landing page (como parte do perfil) e na sidebar (editável sem sair da sala).
- Enviado junto com cada chamada de análise — não armazenado no servidor.
- O system prompt do backend deve instruir a IA a ignorar instruções que não sejam relacionadas a escrita de textos em inglês.

**Exemplos de uso válido:** "foque em erros de preposição", "use vocabulário de nível B2", "corrija apenas erros que mudam o significado, não estilo".

---

### Épico 8 — Reações a Mensagens

**Conceito:** Reações são feedback leve e social. Permitem que participantes respondam a mensagens sem quebrar o fluxo do chat com uma nova mensagem.

**Regras de negócio:**
- Emojis disponíveis: `👍 👎 😂 ❤️`.
- Uma reação por emoji por participante por mensagem (toggle: adicionar/remover).
- Reações são propagadas em tempo real via WebSocket para todos na sala: eventos `reaction_added` e `reaction_removed`.
- A contagem de reações por emoji é exibida abaixo de cada mensagem.
- Reações são armazenadas em memória junto com o estado da sala e incluídas no `room_snapshot`.

**Decisão técnica — WebSocket em vez de REST:** Reação via polling ou fetch-on-demand não entrega a experiência de tempo real esperada num chat. Os dois eventos WS adicionados (`reaction_added` / `reaction_removed`) seguem o mesmo padrão dos demais eventos do protocolo.

---

### Épico 9 — Notificações

**Conceito:** Usuários frequentemente alternam entre abas. Notificações garantem que mensagens relevantes não sejam perdidas.

**Regras de negócio:**
- Notificação sonora (audio tone) + Browser Notification quando a aba está fora de foco.
- Apenas mensagens de outros participantes disparam notificação.
- Mensagens próprias e correções de IA não disparam notificação.
- Permissão de notificação é solicitada ao entrar na sala.

---

## User Stories

### Sala e acesso

1. Como visitante, quero criar uma nova sala sem cadastro, para começar a praticar imediatamente.
2. Como visitante, quero entrar em uma sala existente informando o código curto, para me juntar a uma conversa em andamento.
3. Como visitante, quero entrar em uma sala existente colando o link completo, para facilitar o acesso pelo link compartilhado.
4. Como participante, quero ver o código da sala na sidebar, para poder compartilhar com outros.
5. Como participante, quero ver o tempo restante da sala na sidebar, para saber quando ela expirará.
6. Como participante, quero ser redirecionado para a landing com mensagem clara quando a sala expirar, para não ficar preso numa tela quebrada.

### Perfil e identidade

7. Como visitante, quero informar meu nome antes de entrar, para ser identificado na conversa.
8. Como visitante, quero que meu nome e API Key sejam salvos no navegador, para não precisar redigitar a cada acesso.
9. Como participante, quero editar meu nome e custom instructions na sidebar sem sair da sala, para ajustar durante a sessão.
10. Como participante em múltiplas abas, quero que cada aba seja um participante independente, para poder simular múltiplos usuários localmente.

### Chat

11. Como participante, quero ver todas as mensagens anteriores da sala ao entrar, para ter contexto da conversa.
12. Como participante, quero enviar mensagens em texto com até 800 caracteres, para expressar minhas ideias.
13. Como participante, quero ver as mensagens dos outros chegando em tempo real, para ter uma experiência de chat fluida.
14. Como participante, quero ver quando outros estão digitando, para saber que uma resposta está chegando.
15. Como participante, quero ver a lista de participantes conectados na sidebar, para saber quem está na sala.
16. Como participante, quero ver o status de conexão (conectado / reconectando / desconectado) na sidebar, para entender o estado da minha sessão.
17. Como participante desconectado, quero que o cliente tente reconectar automaticamente, para não precisar recarregar a página.

### Coach de IA

18. Como participante, quero configurar minha API Key do OpenRouter antes de entrar na sala, para poder usar o coach.
19. Como participante sem API Key, quero ver um aviso claro de que o coach está desabilitado, para entender por que a análise não ocorre.
20. Como participante no modo automático, quero que o coach analise cada mensagem que envio automaticamente, para receber feedback sem esforço extra.
21. Como participante no modo manual, quero escolher quais mensagens enviar para análise, para ter controle sobre quando recebo feedback.
22. Como participante, quero ver a correção da IA abaixo da minha mensagem original com um separador visual, para associar facilmente a correção à mensagem analisada.
23. Como participante, quero clicar em um popover de explicação na correção, para entender o motivo do erro.
24. Como participante, quero ver as correções dos outros participantes, para aprender com os erros alheios.
25. Como participante, quero ver um indicador de "analisando..." enquanto o coach processa, para saber que algo está acontecendo.
26. Como participante, quero ver "Análise indisponível" inline quando o coach falhar, para entender que houve um problema sem que o fluxo seja bloqueado.
27. Como participante, quero poder re-disparar uma análise que falhou via botão "Analisar", para não perder o feedback de uma mensagem importante.

### Custom instructions

28. Como participante, quero escrever instruções personalizadas para o coach na landing, para configurar o feedback antes de entrar.
29. Como participante, quero editar minhas custom instructions na sidebar sem sair da sala, para ajustar o foco do coach durante a prática.
30. Como participante, quero ver um contador de caracteres nas custom instructions, para saber quanto espaço ainda tenho (máx. 250).
31. Como participante, quero que o coach ignore instruções que não sejam sobre escrita, para garantir que o feedback permaneça relevante.

### Reações

32. Como participante, quero reagir a mensagens com `👍 👎 😂 ❤️`, para dar feedback leve sem escrever uma nova mensagem.
33. Como participante, quero que minha reação apareça imediatamente para todos na sala, para uma experiência de tempo real.
34. Como participante, quero remover minha reação clicando novamente no emoji, para corrigir uma reação acidental.
35. Como participante, quero ver a contagem de reações por emoji abaixo de cada mensagem, para ter uma visão rápida do feedback da sala.

### Notificações

36. Como participante com a aba fora de foco, quero receber uma notificação sonora ao chegar uma mensagem de outro participante, para não perder a conversa.
37. Como participante, quero que minhas próprias mensagens e correções de IA não disparem notificação, para evitar ruído desnecessário.

---

## Implementation Decisions

### Arquitetura geral

- O projeto é um refactor disciplinado do código existente, não um rewrite. O protocolo WebSocket, a integração com OpenRouter e o modelo de dados são preservados onde funcionam bem.
- **Regra mandatória:** nenhum arquivo de frontend pode exceder 120 linhas. CSS separado do código por componente. Sem exceções.

### Frontend

- **Estado global via Zustand** — substitui o `useReducer` atual dentro de `useRoomConnection`. O WebSocket client é um módulo separado que despacha para a store; componentes apenas leem slices necessários.
- **Estrutura feature-based com camadas** — `features/landing` e `features/chat`, cada uma com subcamadas `components/` e `hooks/`. Lógica de negócio não vive em componentes de apresentação.
- **Status de conexão como estado de primeira classe** — a store expõe `connected | reconnecting | disconnected`. A UI reage a esse estado para bloquear o composer e exibir banner de reconexão.
- **Reconexão no cliente** — lógica de backoff exponencial no módulo WS, não dentro de componentes. Re-envia `join_room` ao reconectar e aguarda novo `room_snapshot`.

### Backend

- **Arquitetura em camadas (DDD leve)** — sem entidades de domínio explícitas, apenas:
  - `application/usecases/` — orquestra storage + IA, sem conhecer HTTP/WS
  - `infrastructure/storage/` — interface `StorageAdapter` + `InMemoryAdapter`
  - `infrastructure/ai/` — interface `AIProvider` + `OpenRouterProvider`
  - `interface/http/` e `interface/ws/` — entrada do sistema, chama use cases
- **Injeção de dependência** — use cases recebem `StorageAdapter` e `AIProvider` como parâmetros. Testáveis com mocks sem subir servidor.
- **`StorageAdapter` como contrato futuro** — `InMemoryAdapter` é a implementação atual. A interface existe para que um `RedisAdapter` ou `PostgresAdapter` possa ser plugado sem alterar use cases.
- **`AIProvider` como contrato futuro** — `OpenRouterProvider` é a implementação atual. Trocar de modelo ou provider requer apenas nova implementação da interface.
- **`config.ts` com Zod** — todas as variáveis de ambiente são validadas na inicialização do servidor. Falha rápida se configuração estiver incompleta.

### Protocolo WebSocket — mudanças em relação ao estado atual

- **Removido:** campo `analysisMode` de `send_message` e `analyze_message`
- **Adicionado:** campo `customInstructions?: string` em `send_message` e `analyze_message`
- **Adicionado:** eventos `reaction_added` e `reaction_removed`
- **Adicionado:** evento `room_expired`
- **Modificado:** `correction_finished` passa a incluir `error?: boolean` e `errorReason?: 'timeout' | 'invalid_key' | 'rate_limited'`
- **Removido:** campo `visibility` e `visibleToParticipantId` do modelo de mensagem

### Modelo de dados — mudanças

- `Message`: removidos `visibility`, `visibleToParticipantId`, `analysisMode`; adicionados `error?: boolean`, `errorReason?: string`
- `Participant`: sem `customInstructions` — instrução é stateless, enviada por mensagem
- Perfil local (localStorage): adicionado campo `customInstructions: string`

### Custom instructions

- Limite de 250 caracteres validado no frontend (contador + bloqueio) e no backend (Zod, retorna `error` WS se exceder)
- O system prompt do `OpenRouterProvider` inclui instrução explícita para a IA ignorar custom instructions que não sejam sobre escrita de textos em inglês
- Enviadas como campo opcional em `send_message` e `analyze_message` — nunca armazenadas no servidor

### Rate limiting

- Módulo `RateLimiter` isolado (sliding window em memória)
- Configurável via `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS` no `.env`
- Comentários no `.env.example` explicam o propósito de cada variável

### Reações via WebSocket

- Rotas HTTP de reação (`GET/POST/DELETE /api/messages/:id/reactions`) são mantidas para compatibilidade, mas o estado em tempo real flui via WS
- Ao adicionar/remover reação, o servidor emite `reaction_added` / `reaction_removed` para todos na sala
- `room_snapshot` inclui reações agregadas por mensagem

### Notificações

- Apenas mensagens com `authorId !== currentParticipantId` e `role !== 'assistant'` disparam notificação
- Lógica de filtro encapsulada em `shared/notifications.ts`

---

## Testing Decisions

### O que faz um bom teste aqui

- Testa comportamento observável, não implementação interna
- Backend: testa o que o use case retorna/emite dado uma entrada, usando mocks de `StorageAdapter` e `AIProvider`
- Frontend: testa o que o componente renderiza e o que o hook expõe, usando store Zustand real com adapter mockado
- E2E: testa fluxos completos do ponto de vista do usuário, sem conhecimento de implementação

### Módulos a testar

**Backend (Jest):**
- Cada use case individualmente com `StorageAdapter` e `AIProvider` mockados
- Rotas HTTP com supertest — criação de sala, busca por código, reações
- `RateLimiter` — comportamento de janela deslizante e reset

**Frontend (Vitest + Testing Library):**
- Store Zustand — transições de estado (mensagens, participantes, conexão, reações)
- `useRoomConnection` — comportamento de reconexão com WS mockado
- `MessageBubble` — renderização de correção, erro de análise, reações
- `Composer` — bloqueio sem API Key, `Ctrl+Enter` no modo manual

**E2E (Playwright):**
1. Criar sala → entrar com dois participantes → enviar mensagem → ver correção de IA
2. Modo manual → enviar mensagem sem análise → clicar "Analisar" → ver correção
3. Adicionar reação → ver contagem atualizada no outro participante em tempo real
4. Simular queda de WS → ver banner "reconectando" → reconectar → estado restaurado

### Prioridade

Fluxos críticos têm prioridade sobre cobertura percentual. Um teste E2E do fluxo completo vale mais do que 80% de cobertura unitária em arquivos de configuração.

---

## Out of Scope

- Login, cadastro e perfis persistidos no servidor
- Banco de dados real (PostgreSQL, Redis, etc.)
- Moderação e administração de salas
- Histórico longo, exportação ou busca de mensagens
- Sincronização multi-dispositivo (múltiplos dispositivos com o mesmo usuário)
- Analytics e métricas de uso
- Internacionalização (UI em outros idiomas além do português)
- Upload de arquivos ou imagens
- Menções a participantes (`@nome`)
- Threads / respostas aninhadas

---

## Further Notes

### Decisões de produto com impacto técnico

- **Salas descartáveis por design** — não é limitação técnica. O produto se beneficia da efemeridade: usuários entram, praticam, saem. Histórico longo seria ruído.
- **API Key do usuário** — o modelo "traga sua própria chave" evita que o servidor absorva custo de API silenciosamente. É uma decisão de sustentabilidade do produto, não apenas de segurança.
- **Correções sempre públicas** — aprender com os erros alheios é parte da proposta de valor do produto. Correções privadas fragmentariam o aprendizado colaborativo.
- **Custom instructions em vez de modos pré-definidos** — modos `standard`/`rewrite` criavam uma abstração forçada. Texto livre é mais expressivo e adapta-se a qualquer objetivo de aprendizado.

### Débitos eliminados neste refactor

- Arquivos de frontend acima de 120 linhas
- Reações existentes no backend e frontend mas não conectadas entre si nem integradas ao chat
- Estado de conexão não refletido na UI (spinner eterno em falha de análise)
- Rate limiter acoplado dentro do handler WS
- `visibility`/`visibleToParticipantId` no modelo sem uso real
- Falta de testes fora do módulo de reações
- Variáveis de ambiente sem documentação inline
