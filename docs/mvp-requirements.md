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
- Resposta do agente enviada como mensagem privada somente ao autor.

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
- A resposta da IA aparece como mensagem separada do agente e so o autor original pode ve-la.
- A arquitetura inicial e otimizada para conversa pequena, mas nao trava a evolucao para mais participantes.

## Novos requisitos desta iteracao de planejamento

### 1. Menu de opcoes do agente no chat

Adicionar no chat um seletor de modo do agente com as opcoes:

- `Automatico`:
	- Toda mensagem enviada pelo usuario dispara analise do agente automaticamente.
	- Mantem o comportamento atual como padrao inicial.
- `Manual`:
	- O envio da mensagem nao dispara analise automaticamente.
	- Cada mensagem propria deve exibir uma acao de "Analisar com agente" ao lado da mensagem.
	- A analise e disparada somente quando o usuario clica nessa acao.

### 2. Separacao de paginas

Criar as paginas seguindo boas praticas de frontend em react. Observando principios basicos como SOLID, pensando em componentização, custom hooks e isolamento de lógicas pensando em manutenção futura. Buscar separar CSS de código também. Estabelecer um limite em quantidade de linhas para cada arquivo de frontend, sem ultrapassar 120 linhas de código. Se for necessário pergunte ao desenvolvedor como proceder

# Landing page
    - Descrição basica do que o sistema faz
    - Informações basicas: Nome e API Key
    - Criar nova sala
    - Entrar em sala existente

# Sala de conversa

    A tela deve ter uma altura maxima de 100dvh, não deve existir nenhum tipo de scroll na pagina inteira. As correções de IA devem ser apresentadas para todos os usuários. Será composta pelos seguintes elementos:

    ## Painel lateral

    Será utilizado como um painel de visualização de informações e configurações do client. Irá exibir as seguintes informações:
    
        - Modo do agente de IA
            - Automatico: realiza analise a cada mensagem enviada pelo usuário
            - Manual: Exibe um botão no balão de conversa para que o usuário selecione quando realizar a analise (ou o usuário pode pressionar CTRL + Enter para dar trigger na analise automaticamente)
            
        - Participantes da conversa
            Lista de usuários ativos na sala

        - Informações
            - Nome e API Key
            - Botão para reconectar
            - Botão para copiar link para a sala
        
    ## Chat

    Local onde serão exibidas as mensagens, deverá possuir apenas scroll interno. Seguindo um formato de mensagens semelhante aos aplicativos de mensagem mais utilizados como messenger e whatsapp. As mensagens deverão ser em formato de balão. Essa area deverá ser dividida em duas partes, a área de mensagens e o footer, que será fixo. Neste footer haverá o input e botão para enviar.

        - Balão de mensagem
            Quando houver análise e correção por parte do agente de IA deverá exibir uma linha horizontal, ao fim da linha exibir um icone que ao clicar em cima exibe um popover com explicação do erro em um formato semelhante ao desenho abaixo:
            __________________________________
            |mensagem do usuário             |
            |mensagem corrigida (i)          |
            |________________________________|

        - Notificações
            - Reproduzir som ao receber nova mensagem
            - Enviar notificação do browser

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
- Adicionar estado de configuracao do modo de agente por usuario na sala.
- Implementar acao "Analisar com agente" por mensagem propria no modo Manual.
- Ajustar protocolo websocket para suportar disparo manual de analise sem reenvio de mensagem.

## Requisitos nao funcionais iniciais

- Frontend em React + Vite + TypeScript.
- Backend simples em Express + `ws` + TypeScript.
- Persistencia inicial em memoria.
- Limite de taxa por conexao para reduzir abuso.
- CORS restrito por origem configuravel.

## Criterios de aceite para os novos requisitos

### agente Automatico/Manual

- Dado modo `Automatico`, quando o usuario envia mensagem, entao a analise do agente e disparada automaticamente.
- Dado modo `Manual`, quando o usuario envia mensagem, entao nenhuma analise e disparada automaticamente.
- Dado modo `Manual`, quando o usuario clicar em "Analisar com agente" em mensagem propria, entao a analise e disparada para aquela mensagem.
- Em ambos os modos, a resposta do agente permanece privada ao autor da mensagem analisada.

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