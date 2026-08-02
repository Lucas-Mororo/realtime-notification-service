# Realtime Notification Service

Aplicação de demonstração de **notificações em tempo real** utilizando **Server-Sent Events (SSE)**, **Node.js**, **Express**, **Redis Pub/Sub**, **Nginx** e **Docker Compose**.

O projeto foi desenvolvido de forma incremental para demonstrar desde uma implementação simples de SSE até conceitos de arquitetura distribuída, comunicação assíncrona, gerenciamento de conexões e containerização.

---

## 📌 Sobre o projeto

O objetivo principal deste projeto é entender como implementar comunicação em tempo real entre servidor e navegador utilizando **Server-Sent Events (SSE)**.

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

---

# 🏗️ Arquitetura atual

A aplicação atualmente possui três serviços:

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

O frontend, backend e Redis são executados dentro do Docker.

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

para acesso externo, enquanto internamente o backend utiliza:

```text
redis://redis:6379
```

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
│   ├── Dockerfile
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

Isso evita a criação desnecessária de conexões Redis.

---

# 🐳 Docker

A aplicação utiliza Docker Compose para executar todos os componentes.

Atualmente temos:

```text
Docker Compose
│
├── frontend
│   └── Nginx
│
├── backend
│   └── Node.js + Express
│
└── redis
    └── Redis 7
```

---

# 🌐 Frontend com Nginx

O frontend é composto por HTML, CSS e JavaScript estáticos.

Não é necessário utilizar Node.js para servi-lo.

Por isso utilizamos o Nginx:

```text
Browser
    │
    │ localhost:5500
    ▼
Nginx Container
    │
    ▼
index.html
```

O Dockerfile do frontend utiliza:

```dockerfile
FROM nginx:alpine
```

e copia:

```text
frontend/index.html
```

para:

```text
/usr/share/nginx/html/index.html
```

---

# ⚠️ Por que o Frontend usa localhost:3000?

Mesmo estando dentro do Docker, o frontend utiliza:

```javascript
http://localhost:3000
```

para acessar o backend.

Isso acontece porque o JavaScript do frontend é executado pelo **navegador**, e não pelo Nginx.

O Nginx apenas entrega o HTML.

O fluxo é:

```text
Browser
   │
   │ GET localhost:5500
   ▼
Nginx Container
   │
   │ entrega index.html
   ▼
Browser
   │
   │ JavaScript executa
   │
   │ localhost:3000
   ▼
Docker Host
   │
   ▼
Backend Container
```

---

# ⚠️ Por que o Backend usa redis:6379?

O backend está dentro de um container.

Dentro de um container:

```text
localhost
```

representa o próprio container.

Portanto:

```text
redis://localhost:6379
```

não acessaria o container Redis.

O Docker Compose cria uma rede interna e permite que os serviços sejam encontrados pelo nome.

Como o serviço se chama:

```yaml
redis:
```

o backend pode utilizar:

```text
redis://redis:6379
```

O fluxo interno é:

```text
Backend Container
       │
       │ redis:6379
       ▼
Redis Container
```

---

# 🔧 Variáveis de ambiente

O backend utiliza variáveis de ambiente para configurar o ambiente de execução.

Exemplo:

```text
REDIS_URL
```

No ambiente local:

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

com um valor padrão para execução local.

Isso permite que o mesmo código funcione em diferentes ambientes.

---

# 📦 Docker Compose

O Docker Compose controla três serviços:

```text
frontend
backend
redis
```

O frontend utiliza:

```text
5500 → 80
```

O backend utiliza:

```text
3000 → 3000
```

O Redis utiliza:

```text
6379 → 6379
```

A comunicação interna entre os containers utiliza a rede Docker criada automaticamente pelo Compose.

---

# ▶️ Como executar o projeto

## Pré-requisitos

Você precisa ter:

* Docker Desktop
* Git

O Node.js não é necessário para executar a aplicação através do Docker.

---

# 🐳 Executando com Docker

Clone o projeto:

```bash
git clone <repository-url>
```

Entre na pasta:

```bash
cd realtime-notification-service
```

Construa as imagens:

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

Você deverá encontrar:

```text
NAME          STATUS
sse-frontend  Up
sse-backend   Up
sse-redis     Up
```

---

# 📋 Visualizando logs

Frontend:

```bash
docker compose logs -f frontend
```

Backend:

```bash
docker compose logs -f backend
```

Redis:

```bash
docker compose logs -f redis
```

Todos os serviços:

```bash
docker compose logs -f
```

---

# 🛑 Parando a aplicação

Para parar os containers:

```bash
docker compose down
```

Para reconstruir após alterações:

```bash
docker compose down
docker compose build
docker compose up -d
```

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

Retorna:

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
* conexões persistentes
* tratamento de erros

## Redis

* Redis Client
* Pub/Sub
* Publisher
* Subscriber
* canais
* comunicação assíncrona

## Arquitetura

* Singleton
* separação de responsabilidades
* gerenciamento de conexões
* broadcast de eventos
* comunicação entre processos

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

## Frontend

* EventSource
* SSE
* reconexão automática
* comunicação com APIs
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

# 🚧 Próximas evoluções

O projeto continuará evoluindo para conceitos mais avançados:

* Health Checks
* Graceful Shutdown
* Heartbeat do SSE
* `Last-Event-ID`
* IDs de eventos SSE
* múltiplas instâncias do backend
* escalabilidade horizontal
* Load Balancer
* Redis compartilhado entre instâncias
* arquitetura distribuída
* gerenciamento de conexões SSE em múltiplas instâncias
* Redis Streams
* filas
* observabilidade
* logs estruturados
* métricas
* testes automatizados
* testes de carga

---

# 🎯 Objetivo de aprendizado

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
Containerização completa
 │
 ├── Frontend
 ├── Backend
 └── Redis
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
