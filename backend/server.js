const express = require("express");
const cors = require("cors");

const {
    getPublisher,
} = require("./redis/publisher");

const {
    getSubscriber,
} = require("./redis/subscriber");

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
 * o Live Server tanto através de:
 *
 * http://localhost:5500
 *
 * quanto:
 *
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
 * O callback verifica se essa origem
 * está na lista de origens permitidas.
 */
app.use(
    cors({
        origin: (origin, callback) => {

            /**
             * Algumas requisições podem não possuir
             * Origin, por exemplo chamadas feitas
             * diretamente pelo curl.
             */
            if (!origin) {
                return callback(null, true);
            }

            if (ALLOWED_ORIGINS.includes(origin)) {
                return callback(null, true);
            }

            console.warn(
                `[CORS] Origem bloqueada: ${origin}`
            );

            return callback(
                new Error("Origem não permitida pelo CORS.")
            );
        },
    })
);

// ========================================
// CLIENTES SSE
// ========================================

/**
 * Armazena todas as conexões SSE atualmente
 * abertas.
 *
 * Cada navegador conectado adiciona uma
 * resposta HTTP neste Set.
 */
const clients = new Set();

// ========================================
// SSE
// ========================================

app.get("/events", (req, res) => {

    console.log("[SSE] Novo cliente conectado.");

    // Informa ao navegador que esta resposta
    // será um fluxo Server-Sent Events.
    res.setHeader(
        "Content-Type",
        "text/event-stream"
    );

    // Impede cache da conexão.
    res.setHeader(
        "Cache-Control",
        "no-cache"
    );

    // Mantém a conexão HTTP aberta.
    res.setHeader(
        "Connection",
        "keep-alive"
    );

    // Envia os headers imediatamente.
    res.flushHeaders();

    // Guarda a conexão ativa.
    clients.add(res);

    console.log(
        `[SSE] Clientes conectados: ${clients.size}`
    );

    /**
     * Evento inicial.
     *
     * Serve para confirmar que a conexão
     * SSE foi estabelecida corretamente.
     */
    res.write(
        `data: ${JSON.stringify({
            type: "connection",
            message: "Conectado ao servidor SSE",
        })}\n\n`
    );

    /**
     * Quando o navegador fechar a conexão,
     * removemos o cliente do Set.
     */
    req.on("close", () => {

        console.log(
            "[SSE] Cliente desconectado."
        );

        clients.delete(res);

        console.log(
            `[SSE] Clientes conectados: ${clients.size}`
        );
    });
});

// ========================================
// NOTIFICAÇÃO
// ========================================

app.post("/notify", async (req, res) => {

    try {

        const { message } = req.body;

        if (!message) {

            return res.status(400).json({
                error: "A mensagem é obrigatória.",
            });
        }

        const notification = {
            type: "notification",
            message,
            timestamp: new Date().toISOString(),
        };

        /**
         * Obtém o Publisher Singleton.
         */
        const publisher =
            await getPublisher();

        /**
         * Publica a mensagem no Redis.
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
        clients: clients.size,
        channel: CHANNEL,
    });
});

// ========================================
// INICIALIZAÇÃO
// ========================================

async function startServer() {

    try {

        /**
         * O Subscriber precisa ser iniciado
         * quando o servidor sobe.
         */
        const subscriber =
            await getSubscriber();

        /**
         * Escuta o canal de notificações.
         */
        await subscriber.subscribe(
            CHANNEL,
            (message) => {

                console.log(
                    "[Redis Subscriber] Mensagem recebida:",
                    message
                );

                /**
                 * Redis entregou a mensagem.
                 *
                 * Agora enviamos a mensagem para
                 * todos os navegadores conectados
                 * através do SSE.
                 */
                for (const client of clients) {

                    try {

                        client.write(
                            `data: ${message}\n\n`
                        );

                    } catch (error) {

                        console.error(
                            "[SSE] Erro ao enviar mensagem:",
                            error
                        );

                        clients.delete(client);
                    }
                }
            }
        );

        console.log(
            `[Redis Subscriber] Inscrito no canal: ${CHANNEL}`
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

async function shutdown(signal) {

    console.log(
        `\n[Server] Recebido ${signal}. Encerrando...`
    );

    /**
     * Fecha todas as conexões SSE.
     */
    for (const client of clients) {

        try {

            client.end();

        } catch (error) {

            console.error(
                "[SSE] Erro ao fechar conexão:",
                error
            );
        }
    }

    clients.clear();

    /**
     * Fecha o Publisher.
     */
    try {

        const publisher =
            await getPublisher();

        if (publisher?.isOpen) {
            await publisher.quit();
        }

    } catch (error) {

        console.error(
            "[Redis Publisher] Erro ao encerrar:",
            error
        );
    }

    /**
     * Fecha o Subscriber.
     */
    try {

        const subscriber =
            await getSubscriber();

        if (subscriber?.isOpen) {
            await subscriber.quit();
        }

    } catch (error) {

        console.error(
            "[Redis Subscriber] Erro ao encerrar:",
            error
        );
    }

    process.exit(0);
}

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