const express = require("express");
const cors = require("cors");

const {
    getPublisher,
    getPublisherInstance,
    closePublisher,
} = require("./redis/publisher");

const {
    getSubscriber,
    getSubscriberInstance,
    closeSubscriber,
} = require("./redis/subscriber");

const sseConnectionManager =
    require("./sse/connection-manager");

// ========================================
// CONFIGURAÇÕES
// ========================================

const app = express();

const PORT =
    process.env.PORT || 3000;

const CHANNEL =
    process.env.REDIS_CHANNEL || "notifications";

/**
 * Origens permitidas para o frontend.
 *
 * Durante o desenvolvimento podemos acessar
 * a aplicação através de:
 *
 * http://localhost:5500
 * http://127.0.0.1:5500
 */
const ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
];

// ========================================
// MIDDLEWARES
// ========================================

app.use(express.json());

/**
 * Configuração do CORS.
 *
 * Permite que o frontend faça requisições
 * para a API localizada em outra origem.
 */
app.use(
    cors({
        origin: (origin, callback) => {

            /**
             * Requisições sem Origin podem acontecer
             * em chamadas feitas diretamente por curl,
             * Postman ou outros clientes HTTP.
             */
            if (!origin) {
                return callback(null, true);
            }

            if (
                ALLOWED_ORIGINS.includes(origin)
            ) {
                return callback(null, true);
            }

            console.warn(
                `[CORS] Origem bloqueada: ${origin}`
            );

            return callback(
                new Error(
                    "Origem não permitida pelo CORS."
                )
            );
        },
    })
);

// ========================================
// SSE HEARTBEAT
// ========================================

/**
 * Intervalo utilizado pelo heartbeat SSE.
 *
 * A cada 30 segundos o Connection Manager
 * envia um comentário SSE para as conexões
 * ativas.
 *
 * O comentário possui o formato:
 *
 * : heartbeat
 *
 * Esse conteúdo não dispara um evento no frontend,
 * mas ajuda a manter a conexão HTTP ativa.
 */
const SSE_HEARTBEAT_INTERVAL =
    30 * 1000;

const heartbeatInterval =
    setInterval(() => {

        sseConnectionManager.heartbeat();

    }, SSE_HEARTBEAT_INTERVAL);

// ========================================
// SSE
// ========================================

/**
 * Endpoint responsável por estabelecer
 * uma conexão Server-Sent Events.
 *
 * Exemplo:
 *
 * GET /events?userId=lucas&roomId=room-123
 *
 * O userId identifica o usuário.
 *
 * O roomId identifica a sala em que
 * esse usuário deseja receber mensagens.
 */
app.get("/events", (req, res) => {

    const {
        userId,
        roomId,
    } = req.query;

    // ========================================
    // VALIDAÇÃO
    // ========================================

    if (!userId) {

        return res.status(400).json({
            error: "userId é obrigatório.",
        });
    }

    if (!roomId) {

        return res.status(400).json({
            error: "roomId é obrigatório.",
        });
    }

    console.log(
        `[SSE] Novo cliente conectado. ` +
        `Usuário: ${userId} | Sala: ${roomId}`
    );

    // ========================================
    // HEADERS SSE
    // ========================================

    /**
     * Informa ao navegador que essa resposta
     * será um fluxo Server-Sent Events.
     */
    res.setHeader(
        "Content-Type",
        "text/event-stream"
    );

    /**
     * Impede cache da conexão.
     */
    res.setHeader(
        "Cache-Control",
        "no-cache"
    );

    /**
     * Mantém a conexão HTTP aberta.
     */
    res.setHeader(
        "Connection",
        "keep-alive"
    );

    /**
     * Envia os headers imediatamente.
     */
    res.flushHeaders();

    // ========================================
    // REGISTRA CONEXÃO
    // ========================================

    /**
     * Registra a conexão no Connection Manager.
     *
     * O Manager será responsável por associar:
     *
     * userId
     *     ↓
     * roomId
     *     ↓
     * res
     *
     * Dessa forma podemos descobrir posteriormente
     * quais clientes pertencem a determinada sala.
     */
    sseConnectionManager.add(
        userId,
        roomId,
        res
    );

    // ========================================
    // EVENTO DE CONEXÃO
    // ========================================

    /**
     * Envia um evento informando ao frontend
     * que a conexão foi estabelecida.
     */
    sseConnectionManager.send(
        res,
        "connection",
        {
            type: "connection",
            message: "Conectado ao servidor SSE",
            userId,
            roomId,
        }
    );

    // ========================================
    // ENCERRAMENTO
    // ========================================

    /**
     * Quando o navegador fecha a conexão,
     * removemos o cliente do Connection Manager.
     */
    req.on("close", () => {

        console.log(
            `[SSE] Cliente desconectado. ` +
            `Usuário: ${userId} | Sala: ${roomId}`
        );

        sseConnectionManager.remove(
            userId,
            roomId,
            res
        );
    });
});

// ========================================
// NOTIFICAÇÃO
// ========================================

/**
 * Publica uma mensagem no Redis.
 *
 * O Redis não envia diretamente para os navegadores.
 *
 * O fluxo é:
 *
 * HTTP POST
 *    ↓
 * Express
 *    ↓
 * Redis Publisher
 *    ↓
 * Redis Pub/Sub
 *    ↓
 * Redis Subscriber
 *    ↓
 * SSE Connection Manager
 *    ↓
 * Navegadores da sala
 */
app.post("/notify", async (req, res) => {

    try {

        const {
            userId,
            roomId,
            message,
        } = req.body;

        // ========================================
        // VALIDAÇÃO
        // ========================================

        if (!userId) {

            return res.status(400).json({
                error: "userId é obrigatório.",
            });
        }

        if (!roomId) {

            return res.status(400).json({
                error: "roomId é obrigatório.",
            });
        }

        if (
            typeof message !== "string" ||
            !message.trim()
        ) {

            return res.status(400).json({
                error: "A mensagem é obrigatória.",
            });
        }

        // ========================================
        // PAYLOAD
        // ========================================

        const notification = {
            type: "message",
            roomId,
            userId,
            message: message.trim(),
            timestamp:
                new Date().toISOString(),
        };

        // ========================================
        // REDIS PUBLISHER
        // ========================================

        /**
         * Obtém o Publisher Singleton.
         *
         * Se ainda não existir, getPublisher()
         * cria e conecta a instância.
         *
         * Se já existir, a mesma conexão é reutilizada.
         */
        const publisher =
            await getPublisher();

        /**
         * Publica a mensagem no canal Redis.
         */
        await publisher.publish(
            CHANNEL,
            JSON.stringify(notification)
        );

        console.log(
            "[Redis Publisher] Mensagem publicada:",
            notification
        );

        return res.json({
            success: true,
            message: "Mensagem publicada.",
        });

    } catch (error) {

        console.error(
            "[POST /notify] Erro:",
            error
        );

        return res.status(500).json({
            error: "Erro interno do servidor.",
        });
    }
});

// ========================================
// HEALTH CHECK
// ========================================

/**
 * Endpoint utilizado para verificar
 * o estado básico da aplicação.
 */
app.get("/health", (req, res) => {

    const publisher =
        getPublisherInstance();

    const subscriber =
        getSubscriberInstance();

    return res.json({
        status: "ok",

        clients:
            sseConnectionManager.getCount(),

        channel: CHANNEL,

        redis: {
            publisher:
                Boolean(
                    publisher?.isOpen
                ),

            subscriber:
                Boolean(
                    subscriber?.isOpen
                ),
        },
    });
});

// ========================================
// INICIALIZAÇÃO
// ========================================

/**
 * Inicializa todos os recursos necessários
 * antes de disponibilizar o servidor.
 */
async function startServer() {

    try {

        // ========================================
        // REDIS SUBSCRIBER
        // ========================================

        /**
         * O Subscriber precisa estar conectado
         * antes de receber mensagens.
         */
        const subscriber =
            await getSubscriber();

        // ========================================
        // REDIS SUBSCRIBE
        // ========================================

        /**
         * Inscreve o Subscriber no canal.
         *
         * Toda mensagem publicada nesse canal
         * será recebida pelo callback.
         */
        await subscriber.subscribe(
            CHANNEL,
            (message) => {

                console.log(
                    "[Redis Subscriber] Mensagem recebida:",
                    message
                );

                // ========================================
                // REDIS → SSE
                // ========================================

                /**
                 * Encaminha a mensagem para o
                 * Connection Manager.
                 *
                 * O Connection Manager é responsável
                 * por decidir quais clientes devem
                 * receber a mensagem com base no roomId.
                 */
                sseConnectionManager.broadcast(
                    "notification",
                    message
                );
            }
        );

        console.log(
            `[Redis Subscriber] Inscrito no canal: ${CHANNEL}`
        );

        // ========================================
        // SERVER
        // ========================================

        app.listen(
            PORT,
            () => {

                console.log("");

                console.log(
                    "===================================="
                );

                console.log(
                    `API:      http://localhost:${PORT}`
                );

                console.log(
                    `SSE:      http://localhost:${PORT}/events`
                );

                console.log(
                    `Health:   http://localhost:${PORT}/health`
                );

                console.log(
                    "Frontend: localhost:5500 / 127.0.0.1:5500"
                );

                console.log(
                    "===================================="
                );

                console.log("");
            }
        );

    } catch (error) {

        console.error(
            "[Server] Falha ao iniciar aplicação:",
            error
        );

        process.exit(1);
    }
}

// ========================================
// SHUTDOWN
// ========================================

/**
 * Executa o graceful shutdown da aplicação.
 *
 * Ordem:
 *
 * 1. Para o heartbeat.
 * 2. Fecha conexões SSE.
 * 3. Fecha Publisher Redis.
 * 4. Fecha Subscriber Redis.
 * 5. Finaliza o processo.
 */
async function shutdown(signal) {

    console.log(
        `\n[Server] Recebido ${signal}. Encerrando...`
    );

    // ========================================
    // HEARTBEAT
    // ========================================

    clearInterval(
        heartbeatInterval
    );

    // ========================================
    // SSE
    // ========================================

    sseConnectionManager.closeAll();

    // ========================================
    // REDIS PUBLISHER
    // ========================================

    try {

        const publisher =
            getPublisherInstance();

        if (
            publisher &&
            publisher.isOpen
        ) {

            await closePublisher();
        }

    } catch (error) {

        console.error(
            "[Redis Publisher] Erro ao encerrar:",
            error
        );
    }

    // ========================================
    // REDIS SUBSCRIBER
    // ========================================

    try {

        const subscriber =
            getSubscriberInstance();

        if (
            subscriber &&
            subscriber.isOpen
        ) {

            await closeSubscriber();
        }

    } catch (error) {

        console.error(
            "[Redis Subscriber] Erro ao encerrar:",
            error
        );
    }

    console.log(
        "[Server] Aplicação encerrada."
    );

    process.exit(0);
}

// ========================================
// PROCESS SIGNALS
// ========================================

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

// ========================================
// START
// ========================================

startServer();