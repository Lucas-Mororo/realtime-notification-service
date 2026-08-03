const express = require("express");
const cors = require("cors");

const {
    getPublisher,
} = require("./redis/publisher");

const {
    getSubscriber,
} = require("./redis/subscriber");

const sseConnectionManager =
    require("./sse/connection-manager");

// ========================================
// CONFIGURAÇÕES
// ========================================

const app = express();

const PORT = process.env.PORT || 3000;

const CHANNEL =
    process.env.REDIS_CHANNEL || "notifications";

/**
 * Origens permitidas para o frontend.
 *
 * Durante o desenvolvimento podemos acessar
 * o frontend através de:
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
 * O navegador envia o header:
 *
 * Origin: http://127.0.0.1:5500
 *
 * ou:
 *
 * Origin: http://localhost:5500
 *
 * O callback verifica se a origem está
 * na lista de origens permitidas.
 */
app.use(
    cors({
        origin: (origin, callback) => {
            /**
             * Algumas requisições podem não possuir
             * Origin, como chamadas feitas diretamente
             * através do curl.
             */
            if (!origin) {
                return callback(null, true);
            }

            if (ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }

            console.warn(
                `[CORS] Origem bloqueada: ${origin} `
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
 * Intervalo do heartbeat SSE.
 *
 * A cada 30 segundos enviamos um comentário
 * SSE para manter as conexões ativas.
 */
const SSE_HEARTBEAT_INTERVAL = 30 * 1000;

const heartbeatInterval = setInterval(
    () => {
        sseConnectionManager.heartbeat();
    },
    SSE_HEARTBEAT_INTERVAL
);

// ========================================
// SSE
// ========================================

app.get("/events", (req, res) => {

    const { userId } = req.query;

    if (!userId) {

        return res.status(400).json({
            error: "userId é obrigatório.",
        });
    }

    console.log(`[SSE] Novo cliente conectado. Usuário: ${userId}`);

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
     * Impede que intermediários armazenem
     * a resposta em cache.
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
    // REGISTRA CLIENTE
    // ========================================

    /**
     * Guarda a conexão no Set.
     *
     * A partir deste momento o cliente poderá
     * receber eventos publicados no Redis.
     */
    sseConnectionManager.add(userId, res);

    // ========================================
    // EVENTO: CONNECTION
    // ========================================

    /**
     * Envia um evento SSE nomeado informando
     * ao frontend que a conexão foi estabelecida.
     *
     * Formato:
     *
     * event: connection
     * data: {...}
     *
     * No frontend:
     *
     * eventSource.addEventListener(
     *     "connection",
     *     ...
     * );
     */
    sseConnectionManager.send(
        res,
        "connection",
        {
            type: "connection",
            message: "Conectado ao servidor SSE",
        }
    );

    // ========================================
    // ENCERRAMENTO DA CONEXÃO
    // ========================================

    /**
     * O evento "close" é disparado quando
     * o cliente encerra a conexão HTTP.
     *
     * Isso pode acontecer quando:
     *
     * - o usuário fecha a página;
     * - o navegador navega para outra página;
     * - EventSource.close() é chamado;
     * - a conexão é interrompida.
     */
    req.on("close", () => {

        sseConnectionManager.remove(userId, res);

    });
});

// ========================================
// NOTIFICAÇÃO
// ========================================

app.post("/notify", async (req, res) => {

    try {

        const { userId, message } = req.body;

        // ========================================
        // VALIDAÇÃO
        // ========================================

        if (!userId) {

            return res.status(400).json({
                error: "userId é obrigatório.",
            });
        }

        if (!message) {

            return res.status(400).json({
                error: "A mensagem é obrigatória.",
            });
        }

        // ========================================
        // PAYLOAD
        // ========================================

        const notification = {
            type: "notification",
            userId,
            message: message.trim(),
            timestamp: new Date().toISOString(),
        };

        // ========================================
        // REDIS PUBLISHER
        // ========================================

        /**
         * Obtém o Publisher Singleton.
         *
         * A aplicação reutiliza a mesma conexão
         * Redis em vez de criar uma nova conexão
         * a cada requisição HTTP.
         */
        const publisher = await getPublisher();

        /**
         * Publica a notificação no canal Redis.
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
            message: "Notificação publicada.",
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

app.get("/health", (req, res) => {

    return res.json({
        status: "ok",
        clients: sseConnectionManager.getCount(),
        channel: CHANNEL,
    });
});

// ========================================
// INICIALIZAÇÃO
// ========================================

async function startServer() {

    try {
        // ========================================
        // REDIS SUBSCRIBER
        // ========================================

        /**
         * O Subscriber precisa estar conectado
         * antes de começar a receber mensagens.
         *
         * O Singleton garante que teremos uma
         * única conexão Subscriber reutilizável
         * durante o ciclo de vida da aplicação.
         */
        const subscriber = await getSubscriber();

        // ========================================
        // REDIS SUBSCRIBE
        // ========================================

        /**
         * Inscreve o Subscriber no canal Redis.
         *
         * Sempre que o Publisher publicar uma
         * mensagem nesse canal, este callback
         * será executado.
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
                 * A mensagem chegou do Redis.
                 *
                 * Agora ela precisa ser enviada
                 * para todos os navegadores conectados.
                 */
                sseConnectionManager.broadcast(
                    "notification",
                    message
                );
            }
        );

        console.log(
            `[Redis Subscriber] Inscrito no canal: ${CHANNEL} `
        );

        // ========================================
        // SERVER
        // ========================================

        app.listen(PORT, () => {
            console.log("");

            console.log(
                "===================================="
            );

            console.log(
                `API: http://localhost:${PORT}`
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
        });
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
 * Executado quando o processo recebe um
 * sinal de encerramento.
 *
 * O objetivo é realizar um graceful shutdown:
 *
 * 1. Fechar conexões SSE.
 * 2. Limpar o Set de clientes.
 * 3. Encerrar Publisher Redis.
 * 4. Encerrar Subscriber Redis.
 * 5. Encerrar o processo.
 */
async function shutdown(signal) {
    console.log(
        `\n[Server] Recebido ${signal}. Encerrando...`
    );
    clearInterval(heartbeatInterval);

    // ========================================
    // FECHA SSE
    // ========================================

    sseConnectionManager.closeAll();

    // ========================================
    // FECHA PUBLISHER
    // ========================================

    try {
        const publisher = await getPublisher();

        if (publisher && publisher.isOpen) {
            await publisher.quit();

            console.log(
                "[Redis Publisher] Conexão encerrada."
            );
        }

    } catch (error) {

        console.error(
            "[Redis Publisher] Erro ao encerrar:",
            error
        );
    }

    // ========================================
    // FECHA SUBSCRIBER
    // ========================================

    try {
        const subscriber = await getSubscriber();

        if (subscriber && subscriber.isOpen) {
            await subscriber.quit();

            console.log(
                "[Redis Subscriber] Conexão encerrada."
            );
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