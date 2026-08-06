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

const {
    startNotificationSubscriber,
} = require("./redis/notification-subscriber");

const sseConnectionManager =
    require("./sse/connection-manager");

const notificationRoutes =
    require("./routes/notification.routes");
const roomRoutes =
    require("./routes/room.routes");
const roomManagementRoutes =
    require("./routes/room-management.routes");
const sseRoutes =
    require("./routes/sse.routes");
const healthRoutes =
    require("./routes/health.routes");
const authRoutes =
    require("./routes/auth.routes");

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

app.locals.sessions = {};

app.use(authRoutes);
app.use(notificationRoutes);
app.use(roomManagementRoutes);
app.use(roomRoutes);
app.use(sseRoutes);
app.use(healthRoutes);

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

        await startNotificationSubscriber();

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