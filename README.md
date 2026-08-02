# Realtime Notification Service

Aplicação de demonstração de **notificações em tempo real** utilizando **Server-Sent Events (SSE)**, **Node.js**, **Express**, **Redis Pub/Sub** e **Docker**.

O projeto foi desenvolvido de forma incremental para demonstrar desde uma implementação simples de SSE até uma arquitetura mais próxima de uma aplicação real, utilizando Redis como mecanismo de comunicação entre processos.

---

## 📌 Sobre o projeto

O objetivo principal deste projeto é entender como implementar comunicação em tempo real entre servidor e navegador utilizando **Server-Sent Events (SSE)**.

Diferentemente de uma API HTTP tradicional, onde o cliente faz uma requisição e recebe uma resposta, com SSE o navegador mantém uma conexão HTTP aberta com o servidor.

O servidor pode então enviar novos eventos para o navegador sempre que alguma informação estiver disponível.

Neste projeto, o fluxo completo é:

```text
Frontend
    │
    │ EventSource
    │ GET /events
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
* Docker
* Docker Compose
* HTML
* CSS
* JavaScript
* CORS

---

# 🏗️ Arquitetura atual

Atualmente, o projeto possui três componentes principais:

```text
┌──────────────────────────────┐
│          Frontend            │
│                              │
│      HTML + JavaScript       │
│                              │
│      localhost:5500          │
└──────────────┬───────────────┘
               │
               │ HTTP + SSE
               ▼
┌──────────────────────────────┐
│       Node.js + Express      │
│                              │
│       Docker Container       │
│                              │
│       localhost:3000         │
└──────────────┬───────────────┘
               │
               │ Redis Pub/Sub
               ▼
┌──────────────────────────────┐
│            Redis             │
│                              │
│       Docker Container       │
│                              │
│       localhost:6379         │
└──────────────────────────────┘
```

O frontend permanece independente do Express.

O backend e o Redis são gerenciados pelo Docker Compose.

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
│   └── server.js
│
├── frontend/
│   └── index.html
│
├── .dockerignore
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

---

# 🔌 Server-Sent Events

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

o navegador executa:

```javascript
eventSource.onmessage = (event) => {
    console.log(event.data);
};
```

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

A conexão permanece aberta.

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

Em vez disso, existe uma única instância compartilhada do Publisher e uma única instância compartilhada do Subscriber.

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

Isso é importante principalmente quando a aplicação recebe muitas requisições simultâneas.

---

# 🐳 Docker

A aplicação utiliza Docker para executar o backend e o Redis.

A arquitetura atual é:

```text
Docker Compose
│
├── backend
│   ├── Node.js
│   └── Express
│
└── redis
    └── Redis 7
```

---

# 🐳 Dockerfile

O `Dockerfile` define como a imagem do backend será construída.

A imagem base utilizada é:

```dockerfile
FROM node:24-alpine
```

Depois o projeto é copiado para:

```text
/app
```

As dependências são instaladas com:

```bash
npm ci
```

E a aplicação é iniciada com:

```bash
node backend/server.js
```

---

# 🌐 Docker Networking

Um dos conceitos mais importantes desta etapa é a comunicação entre containers.

O backend **não utiliza**:

```text
redis://localhost:6379
```

quando está rodando dentro do Docker.

Ele utiliza:

```text
redis://redis:6379
```

Isso acontece porque `redis` é o nome do serviço definido no `docker-compose.yml`.

Exemplo:

```yaml
services:

  backend:
    ...

  redis:
    image: redis:7-alpine
```

O Docker cria uma rede interna e permite que o backend encontre o Redis através do hostname:

```text
redis
```

---

# ⚠️ localhost dentro do Docker

É importante entender que:

```text
localhost
```

dentro de um container significa:

> O próprio container.

Portanto:

```text
backend container
localhost:6379
```

significa:

```text
backend container → backend container
```

Não significa:

```text
backend container → Redis container
```

Para acessar o Redis:

```text
backend container
       │
       │ redis:6379
       ▼
Redis container
```

---

# 🔧 Variáveis de ambiente

O backend utiliza variáveis de ambiente para permitir que a mesma aplicação funcione em diferentes ambientes.

Exemplo:

```text
REDIS_URL
```

Localmente:

```text
redis://localhost:6379
```

Dentro do Docker:

```text
redis://redis:6379
```

O código utiliza:

```javascript
process.env.REDIS_URL
```

e possui um valor padrão para desenvolvimento local.

Isso evita colocar configurações específicas do ambiente diretamente no código.

---

# 📦 Docker Compose

O Docker Compose controla os serviços da aplicação.

Atualmente temos:

```text
backend
redis
```

O backend expõe:

```text
3000
```

O Redis expõe:

```text
6379
```

A comunicação interna entre os containers utiliza a rede Docker criada automaticamente pelo Compose.

---

# ▶️ Como executar o projeto

## Pré-requisitos

Você precisa ter:

* Docker Desktop
* Git

O Node.js é necessário apenas se quiser executar a aplicação diretamente fora do Docker.

---

# 🐳 Executando com Docker

Primeiro clone o projeto:

```bash
git clone <repository-url>
```

Entre na pasta:

```bash
cd realtime-notification-service
```

Construa a imagem:

```bash
docker compose build
```

Inicie os serviços:

```bash
docker compose up -d
```

Verifique os containers:

```bash
docker compose ps
```

Você deverá encontrar algo semelhante a:

```text
NAME          STATUS
sse-backend   Up
sse-redis     Up
```

---

# 📋 Visualizando logs

Para acompanhar os logs do backend:

```bash
docker compose logs -f backend
```

Para acompanhar os logs do Redis:

```bash
docker compose logs -f redis
```

Para visualizar todos:

```bash
docker compose logs -f
```

---

# 🛑 Parando a aplicação

Para parar os containers:

```bash
docker compose down
```

Para reconstruir a aplicação após alterações:

```bash
docker compose down
docker compose build
docker compose up -d
```

---

# 🌐 Executando o Frontend

Atualmente o frontend permanece independente do backend.

Ele pode ser executado utilizando o **Live Server** do VS Code ou outro servidor HTTP estático.

O frontend deve estar disponível em:

```text
http://localhost:5500
```

ou:

```text
http://127.0.0.1:5500
```

O backend permite ambas as origens através do CORS.

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

Retorna informações sobre o estado da aplicação:

```json
{
    "status": "ok",
    "clients": 1,
    "channel": "notifications"
}
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

Abra o frontend em:

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

Este projeto foi construído para estudar os seguintes conceitos:

### Backend

* Node.js
* Express
* HTTP
* REST
* Middleware
* CORS
* Server-Sent Events
* conexões persistentes
* tratamento de erros

### Redis

* Redis Client
* Pub/Sub
* Publisher
* Subscriber
* canais
* comunicação assíncrona

### Arquitetura

* Singleton
* separação de responsabilidades
* gerenciamento de conexões
* broadcast de eventos
* comunicação entre processos

### Docker

* Dockerfile
* Docker Image
* Docker Container
* Docker Compose
* Docker Network
* Service Discovery
* Environment Variables
* Port Mapping
* Container Networking

---

# 📈 Evolução planejada

O projeto será evoluído progressivamente.

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

## Etapa 3 — Dockerização

Backend e Redis executando dentro do Docker:

```text
Docker Compose
│
├── Node.js
└── Redis
```

---

## Próximas evoluções

As próximas etapas deverão explorar conceitos como:

* frontend dentro do Docker
* múltiplas instâncias do backend
* Load Balancer
* Redis compartilhado entre instâncias
* escalabilidade horizontal
* gerenciamento de conexões SSE
* heartbeat
* reconexão automática
* `Last-Event-ID`
* event IDs
* graceful shutdown
* health checks
* Docker healthcheck
* observabilidade
* métricas
* logs estruturados
* Redis Streams
* filas
* arquitetura distribuída
* testes automatizados
* testes de carga
* possíveis limitações do SSE em ambientes distribuídos

O objetivo é transformar gradualmente este projeto de uma aplicação didática simples em uma arquitetura capaz de demonstrar conceitos utilizados em sistemas de produção.

---

# 📚 Objetivo de aprendizado

O objetivo não é apenas fazer notificações aparecerem no navegador.

O projeto busca compreender **por que cada componente existe e como eles se relacionam**.

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
