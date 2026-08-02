# SSE + Express + Redis Pub/Sub

Projeto didático demonstrando como implementar **Server-Sent Events (SSE)** utilizando:

* Node.js
* Express
* Server-Sent Events
* Redis
* Redis Pub/Sub
* Singleton
* HTML + JavaScript puro

O objetivo é entender como manter uma conexão HTTP aberta entre navegador e servidor para que o backend possa enviar notificações em tempo real, utilizando o Redis como mecanismo de distribuição de eventos.

---

# 1. O que este projeto faz?

A aplicação permite que vários navegadores mantenham uma conexão aberta com o servidor utilizando **Server-Sent Events**.

Quando uma notificação é criada:

```text
Cliente
   │
   │ POST /notify
   ▼
Express
   │
   │ PUBLISH
   ▼
Redis
   │
   │ SUBSCRIBE
   ▼
Express
   │
   │ SSE
   ├──────────────► Browser 1
   ├──────────────► Browser 2
   └──────────────► Browser 3
```

Assim, uma única notificação pode ser enviada para todos os clientes conectados.

---

# 2. O que é Server-Sent Events?

**Server-Sent Events**, ou SSE, é uma tecnologia que permite que o servidor envie dados para o navegador continuamente através de uma conexão HTTP que permanece aberta.

Normalmente, uma requisição HTTP funciona assim:

```text
Browser
   │
   │ GET /users
   ▼
Server
   │
   │ response
   ▼
Browser

Conexão encerrada
```

Com SSE:

```text
Browser
   │
   │ GET /events
   ▼
Server
   │
   │ conexão permanece aberta
   │
   ├──── evento
   ├──── evento
   ├──── evento
   ├──── evento
   └──── ...
```

O navegador fica esperando novas informações.

---

# 3. SSE é WebSocket?

Não.

Apesar de ambos permitirem comunicação em tempo real, existem diferenças importantes.

## SSE

A comunicação é principalmente:

```text
SERVER
   │
   │
   ▼
CLIENT
```

Ou seja, o servidor envia eventos para o cliente.

O navegador utiliza:

```javascript
const eventSource = new EventSource("/events");
```

---

## WebSocket

O WebSocket permite comunicação bidirecional:

```text
CLIENT ◄──────────► SERVER
```

Tanto cliente quanto servidor podem enviar mensagens através da conexão.

---

## Quando SSE pode ser interessante?

SSE é uma ótima opção para situações como:

* notificações;
* atualização de status;
* acompanhamento de processamento;
* dashboards;
* monitoramento;
* feeds;
* progresso de tarefas;
* atualizações em tempo real.

Se o cliente precisa enviar muitas mensagens para o servidor através da mesma conexão, WebSocket pode ser mais adequado.

---

# 4. Tecnologias utilizadas

## Node.js

Runtime responsável pela execução do JavaScript no backend.

## Express

Framework HTTP utilizado para criar:

* rotas;
* middleware;
* API;
* endpoint SSE.

## Redis

Banco de dados em memória que também oferece recursos de:

* cache;
* Pub/Sub;
* filas;
* armazenamento temporário;
* comunicação entre processos.

Neste projeto utilizamos especificamente o **Redis Pub/Sub**.

## HTML + JavaScript

O frontend utiliza JavaScript puro para abrir a conexão SSE e receber os eventos.

---

# 5. Estrutura do projeto

```text
sse-redis/
│
├── package.json
├── server.js
├── docker-compose.yml
│
├── redis/
│   ├── publisher.js
│   └── subscriber.js
│
└── public/
    └── index.html
```

---

# 6. Responsabilidade de cada arquivo

## `server.js`

É responsável pela aplicação HTTP.

Ele contém:

* Express;
* rotas;
* endpoint SSE;
* gerenciamento dos clientes conectados;
* publicação de notificações;
* inicialização do subscriber.

---

## `redis/publisher.js`

Responsável pelo Redis Publisher.

Ele:

1. cria o cliente Redis;
2. conecta ao Redis;
3. trata erros;
4. mantém uma instância Singleton;
5. disponibiliza essa instância para o restante da aplicação.

---

## `redis/subscriber.js`

Responsável pelo Redis Subscriber.

Ele:

1. cria o cliente Redis;
2. conecta ao Redis;
3. trata erros;
4. mantém uma instância Singleton;
5. disponibiliza essa instância para o restante da aplicação.

---

## `public/index.html`

Frontend da aplicação.

Ele:

1. abre a conexão SSE;
2. recebe eventos;
3. mostra notificações;
4. envia `POST /notify`.

---

## `docker-compose.yml`

Responsável por executar o Redis através do Docker.

---

# 7. Pré-requisitos

Você precisa ter instalado:

* Node.js;
* npm;
* Docker.

Verifique:

```bash
node --version
```

```bash
npm --version
```

```bash
docker --version
```

---

# 8. Instalando o projeto

Clone o projeto ou crie a estrutura manualmente.

Depois entre na pasta:

```bash
cd sse-redis
```

Instale as dependências:

```bash
npm install
```

---

# 9. Subindo o Redis

O projeto utiliza Docker para executar o Redis.

Execute:

```bash
docker compose up -d
```

Verifique:

```bash
docker ps
```

Você deverá encontrar um container Redis em execução.

---

# 10. Iniciando a aplicação

Execute:

```bash
npm run dev
```

Ou:

```bash
npm start
```

Se tudo estiver funcionando, você verá algo parecido com:

```text
[Redis Subscriber] Conectado ao Redis.
[Redis] Inscrito no canal: notifications

====================================
Servidor: http://localhost:3000
SSE:      http://localhost:3000/events
Health:  http://localhost:3000/health
Canal:   notifications
====================================
```

Abra:

```text
http://localhost:3000
```

---

# 11. Testando SSE

Abra duas abas:

```text
Aba 1:
http://localhost:3000

Aba 2:
http://localhost:3000
```

As duas páginas abrirão uma conexão com:

```text
/events
```

No backend teremos:

```text
Browser 1 ─────┐
               │
Browser 2 ─────┼────► Express
               │
Browser 3 ─────┘
```

Cada navegador possui sua própria conexão SSE.

---

# 12. Enviando uma notificação

Na interface, escreva:

```text
Novo pedido recebido!
```

Clique em:

```text
Enviar
```

O frontend fará:

```http
POST /notify
```

com:

```json
{
  "message": "Novo pedido recebido!"
}
```

---

# 13. O que acontece depois?

O `server.js` recebe:

```javascript
app.post("/notify", async (req, res) => {
```

Extrai:

```javascript
const { message } = req.body;
```

Cria:

```javascript
const notification = {
    type: "notification",
    message: message.trim(),
    timestamp: new Date().toISOString(),
};
```

Depois obtém o Publisher:

```javascript
const publisher = await getPublisher();
```

E publica no Redis:

```javascript
await publisher.publish(
    CHANNEL,
    JSON.stringify(notification)
);
```

---

# 14. O que significa PUBLISH?

O Redis possui um sistema chamado **Pub/Sub**.

Imagine:

```text
CHANNEL
notifications
```

O Publisher publica:

```text
PUBLISH notifications "Nova mensagem"
```

O Redis recebe isso e procura quem está inscrito nesse canal.

---

# 15. O Subscriber

O nosso Subscriber executa:

```javascript
await subscriber.subscribe(
    CHANNEL,
    (message) => {
        // ...
    }
);
```

Isso significa:

> "Redis, quero receber todas as mensagens publicadas no canal `notifications`."

Então temos:

```text
Publisher
    │
    │ PUBLISH
    ▼
 Redis
    │
    │ mensagem
    ▼
Subscriber
```

---

# 16. O que o Subscriber faz com a mensagem?

Quando recebe:

```javascript
(message) => {
```

ele percorre todos os clientes SSE:

```javascript
for (const client of clients) {
```

E envia:

```javascript
client.write(
    `data: ${message}\n\n`
);
```

Isso é o ponto onde Redis e SSE se encontram.

---

# 17. Por que `data:`?

SSE possui um formato próprio.

Um evento simples é:

```text
data: Olá mundo!


```

Observe que existem **duas quebras de linha** no final.

No código:

```javascript
res.write(
    `data: ${message}\n\n`
);
```

Temos:

```text
data: mensagem
\n
\n
```

O segundo `\n` indica o fim do evento.

---

# 18. O frontend recebe o evento

No navegador temos:

```javascript
const eventSource =
    new EventSource("/events");
```

Isso cria uma conexão persistente com:

```text
GET /events
```

Depois:

```javascript
eventSource.onmessage = (event) => {
```

é executado sempre que o servidor enviar uma mensagem SSE.

A mensagem chega em:

```javascript
event.data
```

Como enviamos JSON:

```javascript
const data =
    JSON.parse(event.data);
```

Agora podemos utilizar:

```javascript
data.message
```

```javascript
data.timestamp
```

```javascript
data.type
```

---

# 19. O fluxo completo

Este é o fluxo mais importante do projeto:

```text
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       │ POST /notify
       ▼
┌──────────────┐
│   Express    │
└──────┬───────┘
       │
       │ publisher.publish()
       ▼
┌──────────────┐
│    Redis     │
│   Pub/Sub    │
└──────┬───────┘
       │
       │ subscriber
       ▼
┌──────────────┐
│   Express    │
└──────┬───────┘
       │
       │ res.write()
       ▼
┌──────────────┐
│  SSE Client  │
└──────────────┘
```

---

# 20. Por que temos Publisher e Subscriber separados?

Um detalhe importante do Redis Pub/Sub é que uma conexão utilizada para `SUBSCRIBE` possui um comportamento diferente.

Por isso utilizamos:

```text
Redis
 │
 ├── Publisher
 │
 └── Subscriber
```

O Publisher publica:

```javascript
publisher.publish(...)
```

O Subscriber escuta:

```javascript
subscriber.subscribe(...)
```

Não tratamos os dois como a mesma responsabilidade.

---

# 21. Por que não criar um Redis para cada usuário?

Imagine que tivéssemos:

```javascript
app.get("/events", async (req, res) => {

    const redis =
        createClient();

    await redis.connect();

});
```

Cada usuário que acessasse `/events` criaria uma nova conexão Redis.

Se tivermos:

```text
100 usuários
```

poderíamos ter:

```text
100 conexões Redis
```

Com:

```text
10.000 usuários
```

teríamos um problema muito maior.

Isso gera overhead desnecessário.

---

# 22. Singleton

Por isso utilizamos Singleton.

No `publisher.js`:

```javascript
let publisher = null;
```

Na função:

```javascript
async function getPublisher() {

    if (publisher) {
        return publisher;
    }

    publisher = createClient(...);

    await publisher.connect();

    return publisher;
}
```

Na primeira chamada:

```text
getPublisher()
     │
     ▼
publisher existe?
     │
     └── NÃO
          │
          ▼
     createClient()
          │
          ▼
       connect()
          │
          ▼
       retorna
```

Na segunda:

```text
getPublisher()
     │
     ▼
publisher existe?
     │
     └── SIM
          │
          ▼
    retorna existente
```

Assim:

```text
getPublisher()
getPublisher()
getPublisher()
getPublisher()
```

utilizam a mesma instância.

---

# 23. Singleton não significa uma conexão por usuário

Esse é um conceito fundamental.

Temos:

```text
1000 usuários
      │
      │
      ▼
1000 conexões SSE
      │
      ▼
   Express
      │
      ├──── Publisher Singleton
      │
      └──── Subscriber Singleton
                    │
                    ▼
                  Redis
```

Não temos:

```text
1000 usuários
      │
      ├── Redis #1
      ├── Redis #2
      ├── Redis #3
      ├── ...
      └── Redis #1000
```

Cada cliente precisa da sua própria conexão SSE.

Mas os clientes não precisam de uma conexão Redis individual.

---

# 24. Por que `clients` é um Set?

Temos:

```javascript
const clients = new Set();
```

Quando um usuário conecta:

```javascript
clients.add(res);
```

Quando desconecta:

```javascript
clients.delete(res);
```

Podemos imaginar:

```text
clients

┌─────────────────┐
│ Browser A       │
├─────────────────┤
│ Browser B       │
├─────────────────┤
│ Browser C       │
└─────────────────┘
```

Quando Redis recebe uma notificação:

```javascript
for (const client of clients) {
    client.write(...);
}
```

O servidor envia para todos.

---

# 25. Por que precisamos remover clientes desconectados?

Imagine:

```text
Browser A
   │
   │ conexão SSE
   ▼
Express
```

O usuário fecha a aba.

Se não fizermos:

```javascript
clients.delete(res);
```

o servidor continuará mantendo uma referência para aquela conexão.

Isso pode provocar:

* consumo desnecessário de memória;
* referências de conexões antigas;
* erros ao tentar enviar eventos;
* vazamento de recursos.

Por isso temos:

```javascript
req.on("close", () => {

    clients.delete(res);

});
```

---

# 26. O que acontece se o navegador perder a conexão?

O frontend utiliza:

```javascript
const eventSource =
    new EventSource("/events");
```

Uma característica importante do `EventSource` é que ele pode tentar reconectar automaticamente quando a conexão é perdida.

Podemos monitorar:

```javascript
eventSource.onerror = (error) => {
    console.error(error);
};
```

E:

```javascript
eventSource.onopen = () => {
    console.log("Conectado!");
};
```

---

# 27. Testando diretamente o SSE

Abra:

```text
http://localhost:3000/events
```

Você deverá receber algo parecido com:

```text
data: {"type":"connection","message":"Conectado ao servidor SSE"}
```

A requisição não termina imediatamente.

Ela permanece aberta.

Esse é um dos pontos fundamentais do SSE.

---

# 28. Testando a API sem frontend

Você também pode testar o endpoint diretamente.

Com cURL:

```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Olá SSE!\"}"
```

Resposta:

```json
{
  "success": true,
  "message": "Notificação publicada."
}
```

Se houver navegadores conectados ao SSE, eles receberão a mensagem.

---

# 29. Health Check

A aplicação possui:

```http
GET /health
```

Acesse:

```text
http://localhost:3000/health
```

Exemplo:

```json
{
  "status": "ok",
  "sseClients": 2,
  "timestamp": "2026-08-02T..."
}
```

Isso é útil para verificar se a aplicação está funcionando e quantos clientes SSE estão conectados.

---

# 30. Por que Redis é útil aqui?

Sem Redis, poderíamos fazer:

```text
POST /notify
     │
     ▼
Express
     │
     ├── SSE Client A
     ├── SSE Client B
     └── SSE Client C
```

Isso funciona.

Mas imagine uma aplicação escalada horizontalmente:

```text
                Load Balancer
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Node 1      Node 2      Node 3
```

Usuários diferentes podem estar conectados a servidores diferentes.

Exemplo:

```text
User A ──► Node 1
User B ──► Node 2
User C ──► Node 3
```

Se uma notificação chegar no Node 1:

```text
User A
   │
   ▼
Node 1
```

Como Node 1 avisaria Node 2 e Node 3?

É aqui que Redis Pub/Sub ajuda.

---

# 31. Redis distribuindo eventos

Temos:

```text
                   Redis
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     Node 1        Node 2       Node 3
        │            │            │
        ▼            ▼            ▼
      User A       User B       User C
```

Cada aplicação Node possui seu Subscriber.

Quando alguém publica:

```text
Node 1
  │
  │ PUBLISH
  ▼
Redis
  │
  ├────► Subscriber Node 1
  ├────► Subscriber Node 2
  └────► Subscriber Node 3
```

Cada Node pode então enviar o evento para seus próprios clientes SSE.

---

# 32. Arquitetura em produção

Uma arquitetura mais próxima de produção poderia ser:

```text
                       INTERNET
                           │
                           ▼
                    Load Balancer
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
          Node.js       Node.js       Node.js
          Instance      Instance      Instance
             │             │             │
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                        Redis
                       Pub/Sub
```

Cada processo Node mantém:

```text
1 Publisher
1 Subscriber
N conexões SSE
```

Onde `N` é a quantidade de clientes conectados naquela instância.

---

# 33. Uma limitação importante do Redis Pub/Sub

Redis Pub/Sub possui semântica **at-most-once**.

Ou seja, se um subscriber estiver desconectado no momento da publicação, ele pode perder a mensagem.

Exemplo:

```text
Redis
  │
  │ PUBLISH
  ▼
Subscriber desconectado
```

A mensagem não fica esperando para ser entregue posteriormente.

Se sua aplicação precisa de mensagens persistentes, processamento garantido ou reprocessamento, considere tecnologias como:

* Redis Streams;
* RabbitMQ;
* Apache Kafka;
* outros sistemas de mensageria.

---

# 34. SSE também possui limitações

SSE é excelente para comunicação:

```text
SERVER
   │
   ▼
CLIENT
```

Mas não é uma solução universal para realtime.

Se você precisa de comunicação bidirecional intensa:

```text
CLIENT ◄──────────► SERVER
```

WebSocket pode ser mais apropriado.

---

# 35. Por que não fazer tudo diretamente no `server.js`?

Seria possível colocar tudo em:

```text
server.js
```

Mas rapidamente ele ficaria responsável por:

```text
Express
Redis
SSE
Pub/Sub
Configuração
Validação
Tratamento de erros
Rotas
Serviços
```

Separando:

```text
server.js
   │
   ├── HTTP
   ├── SSE
   └── rotas
       
redis/
   │
   ├── publisher.js
   └── subscriber.js
```

temos melhor separação de responsabilidades.

Isso também facilita posteriormente evoluir para:

```text
src/
├── config/
├── controllers/
├── services/
├── redis/
├── routes/
├── middlewares/
└── server.js
```

---

# 36. Princípios utilizados

Este projeto introduz conceitos importantes de arquitetura backend:

## Separation of Concerns

Cada módulo possui uma responsabilidade específica.

```text
server.js
    ↓
HTTP / SSE

publisher.js
    ↓
Redis PUBLISH

subscriber.js
    ↓
Redis SUBSCRIBE
```

---

## Singleton

Evita criar múltiplas instâncias desnecessárias do cliente Redis dentro do mesmo processo.

---

## Pub/Sub

Desacopla quem publica um evento de quem recebe o evento.

```text
Publisher
    ↓
Redis
    ↓
Subscriber
```

---

## Event-driven architecture

A aplicação reage a eventos.

Exemplo:

```text
Evento:
"novo pedido criado"

       ↓

Redis Pub/Sub

       ↓

Subscribers

       ↓

SSE

       ↓

Interfaces atualizadas
```

---

# 37. Fluxo mental para entender o projeto

Quando estudar esse projeto, pense sempre nestas quatro perguntas:

### 1. Como o navegador recebe eventos?

SSE:

```javascript
new EventSource("/events");
```

### 2. Como o servidor mantém a conexão?

```javascript
clients.add(res);
```

e:

```javascript
res.write(...)
```

### 3. Como uma aplicação distribui a notificação?

Redis Pub/Sub:

```javascript
publisher.publish(...)
```

e:

```javascript
subscriber.subscribe(...)
```

### 4. Por que não criar Redis para cada usuário?

Porque usamos Singleton:

```javascript
getPublisher()
getSubscriber()
```

reutilizando as conexões Redis.

---

# 38. Resumo da arquitetura

```text
                     BROWSER
                        │
                        │ EventSource
                        │
                        ▼
                  GET /events
                        │
                        ▼
                    EXPRESS
                        │
                        │
                 clients: Set
                        │
                        │
                        ▲
                        │
                  res.write()
                        │
                        │
                    SUBSCRIBER
                        ▲
                        │
                        │ SUBSCRIBE
                        │
                      REDIS
                        ▲
                        │
                        │ PUBLISH
                        │
                    PUBLISHER
                        ▲
                        │
                        │
                  POST /notify
                        ▲
                        │
                     CLIENT
```

---

# 39. Para onde evoluir este projeto?

Depois de entender completamente esta implementação, os próximos passos interessantes são:

1. Adicionar `dotenv`.
2. Criar configuração centralizada.
3. Separar Controller, Service e Routes.
4. Criar autenticação.
5. Associar SSE a usuários específicos.
6. Criar canais por usuário.
7. Implementar eventos SSE nomeados.
8. Implementar heartbeat.
9. Implementar reconexão.
10. Adicionar `Last-Event-ID`.
11. Implementar Redis Streams.
12. Rodar múltiplas instâncias Node.
13. Adicionar Load Balancer.
14. Containerizar a aplicação.
15. Adicionar testes automatizados.
16. Adicionar observabilidade.
17. Implementar graceful shutdown.

A partir daí, o projeto deixa de ser apenas um exemplo de SSE e começa a se aproximar de uma arquitetura de **notificações realtime distribuída**.
