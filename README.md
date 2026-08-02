# Realtime Notification Service

Aplicação de demonstração de **notificações em tempo real** utilizando **Server-Sent Events (SSE)**, **Node.js**, **Express**, **Redis Pub/Sub**, **Nginx** e **Docker Compose**.

O projeto foi desenvolvido de forma incremental para demonstrar desde uma implementação simples de SSE até conceitos de arquitetura distribuída, comunicação assíncrona, gerenciamento de conexões, containerização e preparação para escalabilidade.

---

# 📌 Sobre o projeto

O objetivo principal deste projeto é compreender como implementar comunicação em tempo real entre servidor e navegador utilizando **Server-Sent Events (SSE)**.

Diferentemente de uma API HTTP tradicional, onde o cliente faz uma requisição e recebe uma resposta, com SSE o navegador mantém uma conexão HTTP aberta com o servidor.

O servidor pode então enviar novos eventos para o navegador sempre que alguma informação estiver disponível.

Neste projeto, o fluxo completo é:

```text
Frontend
    │
    │ HTTP + SSE
    ▼
Node.js + Express
    │
    │ Redis Pub/Sub
    ▼
Redis
    │
    │ Notification
    ▼
Node.js + Express
    │
    │ SSE
    ▼
Frontend
```

---

# 🚀 Tecnologias utilizadas

* Node.js
* Express
* Server-Sent Events (SSE)
* Redis
* Redis Pub/Sub
* Nginx
* Docker
* Docker Compose
* HTML
* CSS
* JavaScript
* CORS
* Nodemon

---

# 🏗️ Arquitetura atual

A aplicação possui três serviços principais:

```text
┌─────────────────────────────────────────────────────┐
│                    Docker Compose                   │
│                                                     │
│  ┌─────────────────┐                                │
│  │     Frontend    │                                │
│  │                 │                                │
│  │      Nginx      │                                │
│  │       :80       │                                │
│  └────────┬────────┘                                │
│           │                                         │
│           │ HTTP                                    │
│           │                                         │
│  ┌────────▼────────┐                                │
│  │     Backend     │                                │
│  │                 │                                │
│  │ Node.js Express │                                │
│  │      :3000      │                                │
│  └────────┬────────┘                                │
│           │                                         │
│           │ Redis Pub/Sub                           │
│           │                                         │
│  ┌────────▼────────┐                                │
│  │      Redis      │                                │
│  │                 │                                │
│  │      :6379      │                                │
│  └─────────────────┘                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

O frontend, backend e Redis podem ser executados dentro do Docker.

O navegador acessa o frontend através de:

```text
http://localhost:5500
```

O backend é disponibilizado através de:

```text
http://localhost:3000
```

O Redis utiliza:

```text
localhost:6379
```

para acesso externo.

---

# 📂 Estrutura do projeto

```text
realtime-notification-service/
│
├── backend/
│   │
│   ├── redis/
│   │   ├── publisher.js
│   │   └── subscriber.js
│   │
│   ├── Dockerfile.dev
│   └── server.js
│
├── frontend/
│   ├── Dockerfile
│   └── index.html
│
├── .dockerignore
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── package.json
├── package-lock.json
└── README.md
```

---

# 📡 Server-Sent Events

## O que é SSE?

Server-Sent Events é uma tecnologia que permite que o servidor envie eventos para o navegador através de uma conexão HTTP persistente.

O navegador cria uma conexão:

```text
GET /events
```

O servidor mantém essa conexão aberta.

Enquanto ela estiver aberta, o servidor pode enviar novos eventos:

```text
data: {"message":"Nova notificação"}

data: {"message":"Outra notificação"}
```

O navegador recebe esses eventos sem precisar realizar novas requisições HTTP.

---

# 🌐 EventSource

No frontend utilizamos a API nativa do navegador:

```javascript
const eventSource = new EventSource(
    "http://localhost:3000/events"
);
```

O `EventSource` cria uma conexão HTTP persistente com o endpoint SSE.

Quando o servidor envia um evento:

```text
data: {"message":"Olá"}

```

o navegador recebe:

```javascript
eventSource.onmessage = (event) => {
    console.log(event.data);
};
```

> Atualmente o projeto utiliza `onmessage`. Uma evolução planejada será utilizar eventos SSE nomeados com `addEventListener()`.

---

# 🔄 SSE vs HTTP tradicional

Uma API tradicional normalmente funciona assim:

```text
Cliente
   │
   │ GET /notifications
   ▼
Servidor
   │
   │ Response
   ▼
Cliente
```

Depois que a resposta é enviada, a requisição termina.

Se o cliente quiser saber se apareceu uma nova notificação, precisa fazer outra requisição.

Com SSE:

```text
Cliente
   │
   │ GET /events
   ▼
Servidor
   │
   │ conexão permanece aberta
   │
   ├── evento
   ├── evento
   ├── evento
   └── evento
```

---

# 📡 Endpoint SSE

O backend possui:

```text
GET /events
```

Esse endpoint configura a resposta como:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

O servidor também utiliza:

```javascript
res.flushHeaders();
```

para enviar os headers imediatamente.

Depois disso, a conexão permanece aberta.

---

# 👥 Conexões SSE

O backend mantém as conexões abertas em memória através de um `Set`:

```javascript
const clients = new Set();
```

Quando um navegador conecta:

```javascript
clients.add(res);
```

Quando desconecta:

```javascript
clients.delete(res);
```

Assim conseguimos controlar todos os clientes conectados.

Exemplo:

```text
clients

┌─────────────────────────┐
│ SSE Connection #1       │
│ Browser A               │
├─────────────────────────┤
│ SSE Connection #2       │
│ Browser B               │
├─────────────────────────┤
│ SSE Connection #3       │
│ Browser C               │
└─────────────────────────┘
```

Quando uma notificação chega:

```javascript
for (const client of clients) {
    client.write(`data: ${message}\n\n`);
}
```

todos os clientes recebem a mensagem.

---

# 📨 Redis Pub/Sub

O Redis é utilizado como mecanismo de publicação e assinatura de mensagens.

O projeto utiliza dois clientes Redis diferentes:

```text
Publisher
    │
    │ PUBLISH
    ▼
Redis Channel
    │
    │ SUBSCRIBE
    ▼
Subscriber
```

O canal utilizado é:

```text
notifications
```

---

# 📤 Publisher

O Publisher é responsável por publicar mensagens no Redis.

Quando fazemos:

```http
POST /notify
```

o backend cria uma notificação:

```javascript
const notification = {
    type: "notification",
    message,
    timestamp: new Date().toISOString(),
};
```

Depois publica:

```javascript
await publisher.publish(
    "notifications",
    JSON.stringify(notification)
);
```

---

# 📥 Subscriber

O Subscriber fica escutando o canal:

```text
notifications
```

Quando o Redis recebe uma mensagem, o Subscriber recebe:

```javascript
subscriber.subscribe(
    "notifications",
    (message) => {
        // mensagem recebida
    }
);
```

Depois o backend envia essa mensagem para os clientes SSE.

---

# 🔁 Fluxo completo da notificação

Quando uma requisição chega:

```http
POST /notify
```

com:

```json
{
    "message": "Nova notificação!"
}
```

acontece:

```text
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │
       │ POST /notify
       ▼
┌──────────────────┐
│ Node + Express   │
└────────┬─────────┘
         │
         │ PUBLISH
         ▼
┌──────────────────┐
│      Redis       │
│                  │
│ notifications    │
└────────┬─────────┘
         │
         │ SUBSCRIBE
         ▼
┌──────────────────┐
│ Redis Subscriber │
└────────┬─────────┘
         │
         │ Broadcast
         ▼
┌──────────────────┐
│    SSE Clients   │
└────────┬─────────┘
         │
         ▼
     Navegadores
```

---

# 🧩 Singleton

O projeto utiliza o padrão **Singleton** para os clientes Redis.

A ideia é evitar que cada chamada crie uma nova conexão com Redis.

Em vez disso, existe uma instância compartilhada do Publisher e uma instância compartilhada do Subscriber.

Conceitualmente:

```text
Aplicação
    │
    ├── Request A ──┐
    ├── Request B ──┼──► Publisher Singleton
    ├── Request C ──┤
    └── Request D ──┘
```

Em vez de:

```text
Request A → Redis Connection A
Request B → Redis Connection B
Request C → Redis Connection C
Request D → Redis Connection D
```

Isso evita a criação desnecessária de conexões Redis.

---

# 🐳 Docker

O projeto utiliza Docker Compose para executar os componentes da aplicação.

Existem duas configurações de Compose:

```text
docker-compose.yml
```

e:

```text
docker-compose.dev.yml
```

Elas possuem objetivos diferentes.

---

# 🛠️ Ambiente de desenvolvimento

O ambiente de desenvolvimento utiliza:

```text
docker-compose.dev.yml
```

A arquitetura é:

```text
Docker Compose
│
├── Frontend
│   └── Nginx
│
├── Backend
│   ├── Node.js
│   └── Nodemon
│
└── Redis
```

O backend utiliza volumes:

```yaml
volumes:
  - ./backend:/app/backend
  - /app/node_modules
```

Isso permite que o código da máquina seja refletido dentro do container.

O fluxo fica:

```text
Alterar server.js
       │
       ▼
Arquivo local
       │
       │ Docker Volume
       ▼
Arquivo dentro do container
       │
       ▼
Nodemon detecta alteração
       │
       ▼
Node reinicia
```

Dessa forma, não é necessário reconstruir o container a cada alteração no backend.

---

# 🔥 Hot Reload no Windows

Como o projeto pode ser executado utilizando Windows + Docker Desktop + WSL2, o Nodemon utiliza polling para detectar alterações de arquivos.

No `docker-compose.dev.yml`:

```yaml
environment:
  CHOKIDAR_USEPOLLING: "true"
```

O backend utiliza:

```dockerfile
CMD ["npx", "nodemon", "backend/server.js"]
```

Assim o Nodemon é executado dentro do container.

---

# 🚀 Ambiente de execução

O:

```text
docker-compose.yml
```

representa o ambiente de execução sem as ferramentas específicas de desenvolvimento.

Ele não utiliza Nodemon nem o volume de código utilizado no ambiente de desenvolvimento.

O fluxo é:

```text
Código
   ↓
Docker Image
   ↓
Container
   ↓
Node.js
```

Alterações no código não aparecem automaticamente no container.

Para atualizar a aplicação é necessário reconstruir a imagem:

```bash
docker compose up --build -d
```

---

# ⚠️ Desenvolvimento não é produção real

O comando:

```bash
npm run prod
```

é chamado de `prod` porque representa o modo de execução **sem hot reload e sem ferramentas de desenvolvimento**.

Isso não significa que a aplicação esteja pronta para um ambiente de produção real.

Ainda existem melhorias necessárias, como:

* HTTPS/TLS
* Secrets
* Health Checks
* Graceful Shutdown
* Logs estruturados
* Observabilidade
* Métricas
* Limites de recursos
* Segurança
* Load Balancer
* Escalabilidade horizontal
* Alta disponibilidade
* Configuração adequada do Redis

Esses pontos fazem parte da evolução planejada do projeto.

---

# 📦 Scripts do package.json

O projeto possui scripts para facilitar a execução.

## Desenvolvimento

Iniciar:

```bash
npm run dev
```

Esse comando executa:

```text
Docker Compose
    ↓
docker-compose.dev.yml
    ↓
Frontend + Backend + Redis
    ↓
Backend com Nodemon
```

---

## Parar desenvolvimento

```bash
npm run dev:down
```

Equivale a:

```bash
docker compose -f docker-compose.dev.yml down
```

---

## Logs do desenvolvimento

```bash
npm run dev:logs
```

Equivale a:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

---

## Ambiente de execução

```bash
npm run prod
```

Equivale a:

```bash
docker compose up --build -d
```

A opção:

```text
-d
```

significa **detached mode**.

Os containers ficam executando em segundo plano.

---

## Parar ambiente de execução

```bash
npm run prod:down
```

Equivale a:

```bash
docker compose down
```

---

## Logs do ambiente de execução

```bash
npm run prod:logs
```

Equivale a:

```bash
docker compose logs -f
```

---

## Node diretamente na máquina

Também existe:

```bash
npm start
```

que executa:

```bash
node backend/server.js
```

Esse comando **não utiliza Docker**.

Para funcionar dessa maneira, o Redis precisa estar disponível de acordo com a configuração utilizada pelo backend.

Esse modo é útil principalmente para testes rápidos ou quando você deseja executar apenas o Node diretamente na máquina.

---

# 🐳 Comandos Docker sem npm scripts

Todos os scripts são apenas atalhos.

Você pode executar os comandos Docker diretamente no terminal.

---

## Desenvolvimento

Subir:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Subir em background:

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Parar:

```bash
docker compose -f docker-compose.dev.yml down
```

Ver containers:

```bash
docker compose -f docker-compose.dev.yml ps
```

Ver logs:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

Ver logs apenas do backend:

```bash
docker compose -f docker-compose.dev.yml logs -f backend
```

Ver logs apenas do Redis:

```bash
docker compose -f docker-compose.dev.yml logs -f redis
```

Ver logs apenas do frontend:

```bash
docker compose -f docker-compose.dev.yml logs -f frontend
```

---

# 🏭 Ambiente de execução

Construir e iniciar:

```bash
docker compose up --build -d
```

Parar:

```bash
docker compose down
```

Ver containers:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f
```

Ver logs do backend:

```bash
docker compose logs -f backend
```

---

# 🧹 Recriar containers

Caso seja necessário recriar os containers:

```bash
docker compose down
docker compose up --build -d
```

No desenvolvimento:

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up --build -d
```

---

# 🗑️ Remover containers e volumes

Para remover containers e volumes criados pelo Compose:

```bash
docker compose down -v
```

No desenvolvimento:

```bash
docker compose -f docker-compose.dev.yml down -v
```

> ⚠️ Cuidado: remover volumes pode apagar dados persistidos associados aos serviços.

---

# 🌐 URLs

Frontend:

```text
http://localhost:5500
```

Backend:

```text
http://localhost:3000
```

Health Check:

```text
http://localhost:3000/health
```

SSE:

```text
http://localhost:3000/events
```

---

# 🔗 Endpoints

## Health Check

```http
GET /health
```

Exemplo:

```text
http://localhost:3000/health
```

---

## SSE

```http
GET /events
```

Exemplo:

```text
http://localhost:3000/events
```

Esse endpoint mantém uma conexão HTTP aberta com o cliente.

---

## Criar notificação

```http
POST /notify
```

Body:

```json
{
    "message": "Nova notificação!"
}
```

O backend publica a mensagem no Redis e o Subscriber distribui para os clientes SSE conectados.

---

# 🧪 Testando o SSE

Abra:

```text
http://localhost:5500
```

Abra duas ou mais abas do navegador.

Cada aba cria uma conexão SSE independente:

```text
Browser 1 ──────┐
Browser 2 ───────┼──► /events
Browser 3 ──────┘
```

Quando uma notificação for enviada:

```text
POST /notify
```

todos os clientes conectados deverão recebê-la.

---

# 🧠 Conceitos estudados

## Backend

* Node.js
* Express
* HTTP
* REST
* Middleware
* CORS
* Server-Sent Events
* Conexões persistentes
* Tratamento de erros
* Nodemon

## Redis

* Redis Client
* Pub/Sub
* Publisher
* Subscriber
* Canais
* Comunicação assíncrona
* Reutilização de conexões

## Arquitetura

* Singleton
* Separação de responsabilidades
* Gerenciamento de conexões
* Broadcast de eventos
* Comunicação entre processos
* Arquitetura orientada a eventos

## Docker

* Dockerfile
* Docker Image
* Docker Container
* Docker Compose
* Docker Network
* Service Discovery
* Environment Variables
* Port Mapping
* Container Networking
* Bind Mount
* Hot Reload
* Ambientes de desenvolvimento e execução

## Frontend

* EventSource
* SSE
* Reconexão automática
* Comunicação com APIs
* CORS

---

# 📈 Evolução do projeto

## Etapa 1 — SSE básico

Implementação inicial:

```text
Browser
   │
   │ SSE
   ▼
Express
```

---

## Etapa 2 — Redis Pub/Sub

Introdução do Redis:

```text
Express
   │
   ▼
Redis Pub/Sub
   │
   ▼
Express
   │
   ▼
SSE
```

---

## Etapa 3 — Dockerização do Backend

Backend e Redis executando dentro do Docker:

```text
Docker Compose
│
├── Node.js
└── Redis
```

---

## Etapa 4 — Dockerização do Frontend

Toda a aplicação passa a ser gerenciada pelo Docker Compose:

```text
Docker Compose
│
├── Nginx
│   └── Frontend
│
├── Node.js
│   └── Express
│
└── Redis
```

---

## Etapa 5 — Ambiente de desenvolvimento

Separação entre desenvolvimento e execução:

```text
docker-compose.dev.yml
│
├── Nginx
├── Node.js + Nodemon
└── Redis
```

O backend utiliza:

```text
Volume
   ↓
Hot Reload
   ↓
Nodemon
```

Enquanto o ambiente de execução utiliza uma imagem sem Nodemon:

```text
Docker Image
   ↓
Node.js
   ↓
Application
```

---

# 🚧 Próximas evoluções

As próximas etapas planejadas incluem:

### SSE

* Eventos nomeados
* `addEventListener()`
* Heartbeat
* IDs de eventos
* `Last-Event-ID`
* Reconexão
* Controle de retry
* Graceful Shutdown

### Backend

* Health Checks
* Graceful Shutdown
* Tratamento avançado do ciclo de vida
* Logs estruturados
* Configuração por ambiente
* Validação de dados
* Testes automatizados

### Redis

* Gerenciamento avançado das conexões
* Redis Streams
* Filas
* Persistência
* Estratégias de recuperação

### Escalabilidade

* Múltiplas instâncias do Node.js
* Load Balancer
* Redis compartilhado
* Broadcast distribuído
* Gerenciamento de conexões SSE em múltiplas instâncias
* Arquitetura distribuída

### Observabilidade

* Logs
* Métricas
* Monitoramento
* Health Checks
* Tracing

---

# 🎯 Objetivo de aprendizado

O objetivo não é apenas fazer notificações aparecerem no navegador.

O projeto busca compreender **por que cada componente existe, como eles se relacionam e como a arquitetura precisa evoluir quando a aplicação cresce**.

A evolução arquitetural pode ser resumida em:

```text
SSE
 │
 ├── conexão persistente
 │
 ▼
Redis Pub/Sub
 │
 ├── comunicação entre processos
 │
 ▼
Singleton
 │
 ├── reutilização das conexões Redis
 │
 ▼
Docker
 │
 ├── isolamento
 ├── reprodução do ambiente
 └── networking
 │
 ▼
Docker Development Environment
 │
 ├── Volumes
 ├── Nodemon
 └── Hot Reload
 │
 ▼
Eventos SSE Nomeados
 │
 ├── Event Types
 ├── addEventListener
 └── separação de responsabilidades
 │
 ▼
Escalabilidade
 │
 ├── múltiplas instâncias
 ├── Load Balancer
 └── arquitetura distribuída
```

---

# 👨‍💻 Autor

Lucas Martins

Projeto desenvolvido para estudo e aprofundamento em:

* Backend
* Node.js
* Sistemas em tempo real
* Redis
* Docker
* Arquitetura de software
* Sistemas distribuídos
