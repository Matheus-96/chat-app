# MVP Requirements

## Objetivo

Entregar um chat web em tempo real, com experiencia visual de mensageiro, onde usuarios praticam escrita em ingles e recebem feedback privado de IA para cada mensagem enviada.

## Contextualizacao do sistema (estado atual)

### Frontend

- App React + Vite separado em varias paginas por contexto.
- Cria sala, entra em sala por link e conecta websocket.
- Exibe mensagens em baloes, participantes online e estado de conexao.
- Salva perfil local (nome + chave) no navegador.
- Usa identificador de participante por aba via `sessionStorage`.

### Backend

- API HTTP para criar sala e consultar metadados.
- Servidor WebSocket para entrada em sala, mensagens e eventos de presenca.
- Regras basicas de validacao e limite de taxa por conexao.
- Integracao com OpenRouter para revisar a frase em paralelo.
- Resposta do coach enviada como mensagem privada somente ao autor.

### Persistencia

- Estado em memoria no backend.
- Salas com TTL de 24 horas renovado por atividade.
- Sem banco de dados nesta fase.

## Decisoes incorporadas

- Sem login no MVP.
- Usuario informa nome livre ao entrar na sala.
- Chave OpenRouter fica salva somente no navegador.
- Historico da sala tem retencao curta, com TTL inicial de 24 horas.
- A IA responde em paralelo ao envio da mensagem.
- A resposta da IA aparece como mensagem separada do coach e so o autor original pode ve-la.
- A arquitetura inicial e otimizada para conversa pequena, mas nao trava a evolucao para mais participantes.

## Novos requisitos desta iteracao de planejamento

### 1. Menu de opcoes do coach no chat

Adicionar no chat um seletor de modo do coach com as opcoes:

- `Automatico`:
	- Toda mensagem enviada pelo usuario dispara analise do coach automaticamente.
	- Mantem o comportamento atual como padrao inicial.
- `Manual`:
	- O envio da mensagem nao dispara analise automaticamente.
	- Cada mensagem propria deve exibir uma acao de "Analisar com coach" ao lado da mensagem.
	- A analise e disparada somente quando o usuario clica nessa acao.

Regra transversal:

- Independentemente do modo, a resposta do coach continua privada para o autor da mensagem analisada.

### 2. Separacao de paginas

Separar o frontend em duas rotas/paginas principais.

#### Landing page

Deve conter:

- Explicacao basica do produto.
- Input de nome do usuario.
- Input para informar sala existente (nome/codigo/link curto da sala).
- Botao para conectar em sala existente.
- Botao para criar nova sala.

#### Pagina de chat

Deve conter:

- Header com identificacao da sala e status da conexao.
- Lista de mensagens em tempo real.
- Composer para envio de mensagem.
- Lista de participantes conectados.
- Menu de opcoes do coach (Automatico/Manual).
- Acao por mensagem para analise manual quando o modo estiver em Manual.

## Requisitos funcionais implementados nesta base

- Criar sala via API HTTP.
- Entrar na sala via link especifico.
- Conectar participantes em tempo real via WebSocket.
- Enviar mensagens em formato de baloes.
- Disparar revisao de writing ao enviar uma mensagem.
- Receber retorno com frase corrigida e explicacao.
- Mostrar lista de participantes conectados.

## Requisitos funcionais pendentes (prioridade alta)

- Separar a interface em Landing page e Pagina de chat.
- Permitir conexao por codigo/nome de sala na Landing page.
- Adicionar estado de configuracao do modo de coach por usuario na sala.
- Implementar acao "Analisar com coach" por mensagem propria no modo Manual.
- Ajustar protocolo websocket para suportar disparo manual de analise sem reenvio de mensagem.

## Requisitos nao funcionais iniciais

- Frontend em React + Vite + TypeScript.
- Backend simples em Express + `ws` + TypeScript.
- Persistencia inicial em memoria.
- Limite de taxa por conexao para reduzir abuso.
- CORS restrito por origem configuravel.

## Criterios de aceite para os novos requisitos

### Coach Automatico/Manual

- Dado modo `Automatico`, quando o usuario envia mensagem, entao a analise do coach e disparada automaticamente.
- Dado modo `Manual`, quando o usuario envia mensagem, entao nenhuma analise e disparada automaticamente.
- Dado modo `Manual`, quando o usuario clicar em "Analisar com coach" em mensagem propria, entao a analise e disparada para aquela mensagem.
- Em ambos os modos, a resposta do coach permanece privada ao autor da mensagem analisada.

### Separacao de paginas

- Dado acesso a rota inicial, o usuario visualiza a Landing page com explicacao e formulario de entrada.
- Dado preenchimento valido na Landing page, o usuario consegue criar sala ou entrar em sala existente.
- Dado usuario em sala, a Pagina de chat carrega e exibe mensagens, participantes e composer.

## Fora do escopo desta iteracao

- Login, cadastro e perfis persistidos.
- Banco de dados real.
- Grupos completos e moderacao.
- Sincronizacao multi-dispositivo.
- Historico longo, exportacao e analytics.