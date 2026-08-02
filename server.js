const express = require("express");

const {
    getPublisher,
} = require("./redis/publisher");

const {
    getSubscriber,
} = require("./redis/subscriber");


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const app = express();

const PORT =
    process.env.PORT || 3000;

const CHANNEL =
    process.env.REDIS_CHANNEL || "notifications";


// ============================================================
// MIDDLEWARES
// ============================================================

/**
 * Permite que o Express interprete
 * requisições contendo JSON.
 *
 * Exemplo:
 *
 * {
 *     "message": "Novo pedido"
 * }
 */
app.use(express.json());

/**
 * Serve os arquivos estáticos da pasta public.
 *
 * Isso permite acessar:
 *
 * http://localhost:3000
 *
 * e carregar o public/index.html.
 */
app.use(express.static("public"));


// ============================================================
// CLIENTES SSE
// ============================================================

/**
 * Armazena as conexões SSE atualmente abertas.
 *
 * Cada navegador conectado ao endpoint /events
 * terá seu objeto "res" armazenado aqui.
 *
 * Exemplo:
 *
 * clients
 * ├── Browser A
 * ├── Browser B
 * └── Browser C
 *
 * Set é utilizado porque não queremos conexões
 * duplicadas e precisamos adicionar/remover
 * clientes facilmente.
 */
const clients = new Set();


// ============================================================
// SSE - SERVER-SENT EVENTS
// ============================================================

/**
 * Endpoint responsável por estabelecer
 * uma conexão SSE com o navegador.
 *
 * O navegador chama:
 *
 * GET /events
 *
 * A conexão permanece aberta para que o servidor
 * possa enviar novos eventos futuramente.
 */
app.get("/events", (req, res) => {
    console.log(
        "[SSE] Novo cliente conectado."
    );

    // --------------------------------------------------------
    // HEADERS SSE
    // --------------------------------------------------------

    /**
     * Informa ao navegador que a resposta
     * será um fluxo Server-Sent Events.
     */
    res.setHeader(
        "Content-Type",
        "text/event-stream"
    );

    /**
     * Impede cache da resposta.
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


    // --------------------------------------------------------
    // REGISTRA O CLIENTE
    // --------------------------------------------------------

    /**
     * Guarda a conexão SSE.
     *
     * Posteriormente utilizaremos:
     *
     * client.write(...)
     *
     * para enviar notificações.
     */
    clients.add(res);

    console.log(
        `[SSE] Clientes conectados: ${clients.size}`
    );


    // --------------------------------------------------------
    // EVENTO INICIAL
    // --------------------------------------------------------

    /**
     * Envia um evento inicial para confirmar
     * que a conexão foi estabelecida.
     *
     * O formato SSE exige uma linha "data:"
     * e uma linha em branco após o evento.
     *
     * \n\n significa:
     *
     * fim do evento SSE.
     */
    const connectionEvent = {
        type: "connection",
        message: "Conectado ao servidor SSE",
    };

    res.write(
        `data: ${JSON.stringify(
            connectionEvent
        )}\n\n`
    );


    // --------------------------------------------------------
    // DESCONEXÃO DO CLIENTE
    // --------------------------------------------------------

    /**
     * Quando o navegador fecha a aba,
     * recarrega a página ou perde a conexão,
     * esse evento será disparado.
     */
    req.on("close", () => {
        console.log(
            "[SSE] Cliente desconectou."
        );

        /**
         * Remove a conexão do Set.
         *
         * Isso é extremamente importante.
         *
         * Caso contrário, ficaríamos mantendo
         * referências de conexões que já morreram.
         */
        clients.delete(res);

        console.log(
            `[SSE] Clientes conectados: ${clients.size}`
        );
    });
});


// ============================================================
// POST /notify
// ============================================================

/**
 * Publica uma nova notificação no Redis.
 *
 * O fluxo é:
 *
 * Cliente
 *    ↓
 * POST /notify
 *    ↓
 * Express
 *    ↓
 * Publisher
 *    ↓
 * Redis
 *    ↓
 * Subscriber
 *    ↓
 * SSE
 *    ↓
 * Navegadores
 */
app.post("/notify", async (req, res) => {
    try {
        const {
            message,
        } = req.body;


        // ----------------------------------------------------
        // VALIDAÇÃO
        // ----------------------------------------------------

        if (
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                error:
                    "A mensagem é obrigatória.",
            });
        }


        // ----------------------------------------------------
        // CRIA NOTIFICAÇÃO
        // ----------------------------------------------------

        const notification = {
            type: "notification",

            message: message.trim(),

            timestamp:
                new Date().toISOString(),
        };


        // ----------------------------------------------------
        // OBTÉM O PUBLISHER SINGLETON
        // ----------------------------------------------------

        /**
         * Aqui não criamos um novo cliente Redis.
         *
         * getPublisher() retorna a instância
         * Singleton já existente.
         */
        const publisher =
            await getPublisher();


        // ----------------------------------------------------
        // PUBLICA NO REDIS
        // ----------------------------------------------------

        await publisher.publish(
            CHANNEL,
            JSON.stringify(notification)
        );


        console.log(
            "[Redis] Notificação publicada:",
            notification
        );


        // ----------------------------------------------------
        // RESPOSTA HTTP
        // ----------------------------------------------------

        return res.status(200).json({
            success: true,
            message:
                "Notificação publicada.",
        });

    } catch (error) {

        console.error(
            "[POST /notify] Erro:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Erro interno ao publicar notificação.",
        });
    }
});


// ============================================================
// HEALTH CHECK
// ============================================================

/**
 * Endpoint simples para verificar
 * se o servidor está funcionando.
 *
 * GET /health
 */
app.get("/health", (req, res) => {
    return res.status(200).json({
        status: "ok",

        /**
         * Mostra quantos clientes SSE
         * estão atualmente conectados.
         */
        sseClients: clients.size,

        timestamp:
            new Date().toISOString(),
    });
});


// ============================================================
// REDIS SUBSCRIBER
// ============================================================

/**
 * Inicializa o Redis Subscriber.
 *
 * Essa função:
 *
 * 1. Obtém o Singleton do Subscriber.
 * 2. Inscreve-se no canal.
 * 3. Recebe mensagens do Redis.
 * 4. Envia essas mensagens para os clientes SSE.
 */
async function startRedisSubscriber() {

    // --------------------------------------------------------
    // OBTÉM SUBSCRIBER SINGLETON
    // --------------------------------------------------------

    const subscriber =
        await getSubscriber();


    // --------------------------------------------------------
    // SUBSCRIBE
    // --------------------------------------------------------

    await subscriber.subscribe(
        CHANNEL,
        (message) => {

            console.log(
                "[Redis] Mensagem recebida:",
                message
            );


            // ------------------------------------------------
            // ENVIA PARA CLIENTES SSE
            // ------------------------------------------------

            /**
             * Percorre todos os navegadores
             * atualmente conectados.
             */
            for (const client of clients) {

                try {

                    /**
                     * Envia a mensagem utilizando
                     * o protocolo SSE.
                     *
                     * O formato é:
                     *
                     * data: mensagem
                     *
                     */
                    client.write(
                        `data: ${message}\n\n`
                    );

                } catch (error) {

                    /**
                     * Se ocorrer algum problema
                     * ao enviar para um cliente,
                     * removemos essa conexão.
                     */
                    console.error(
                        "[SSE] Erro ao enviar evento:",
                        error
                    );

                    clients.delete(client);
                }
            }
        }
    );


    console.log(
        `[Redis] Inscrito no canal: ${CHANNEL}`
    );
}


// ============================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================

/**
 * Inicializa todos os recursos necessários
 * antes de começar a aceitar requisições.
 */
async function startServer() {

    try {

        console.log(
            "[Server] Inicializando aplicação..."
        );


        // ----------------------------------------------------
        // INICIALIZA SUBSCRIBER
        // ----------------------------------------------------

        /**
         * É importante inicializar o subscriber
         * antes de começar a aceitar requisições.
         *
         * Dessa maneira, o backend já está
         * preparado para receber eventos do Redis.
         */
        await startRedisSubscriber();


        // ----------------------------------------------------
        // INICIALIZA EXPRESS
        // ----------------------------------------------------

        app.listen(
            PORT,
            () => {

                console.log("");
                console.log(
                    "===================================="
                );

                console.log(
                    `Servidor: http://localhost:${PORT}`
                );

                console.log(
                    `SSE:      http://localhost:${PORT}/events`
                );

                console.log(
                    `Health:   http://localhost:${PORT}/health`
                );

                console.log(
                    `Canal:    ${CHANNEL}`
                );

                console.log(
                    "===================================="
                );

                console.log("");
            }
        );

    } catch (error) {

        /**
         * Se Redis não estiver disponível,
         * por exemplo, não queremos iniciar
         * o servidor acreditando que tudo
         * está funcionando.
         */
        console.error(
            "[Server] Falha ao inicializar aplicação:",
            error
        );

        process.exit(1);
    }
}


// ============================================================
// START
// ============================================================

startServer();