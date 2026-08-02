const { createClient } = require("redis");

const REDIS_URL =
    process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Instância Singleton do Redis Subscriber.
 *
 * Essa conexão será utilizada para escutar
 * mensagens publicadas no Redis.
 */
let subscriber = null;

/**
 * Retorna a instância única do Redis Subscriber.
 *
 * Na primeira chamada:
 * - cria o cliente;
 * - configura tratamento de erros;
 * - conecta ao Redis.
 *
 * Nas chamadas seguintes:
 * - reutiliza a mesma conexão.
 */
async function getSubscriber() {

    if (subscriber) {
        return subscriber;
    }

    subscriber = createClient({
        url: REDIS_URL,
    });

    /**
     * Trata erros do cliente Redis.
     */
    subscriber.on("error", (error) => {
        console.error(
            "[Redis Subscriber] Erro:",
            error
        );
    });

    try {

        await subscriber.connect();

        console.log(
            "[Redis Subscriber] Conectado ao Redis."
        );

        return subscriber;

    } catch (error) {

        console.error(
            "[Redis Subscriber] Falha ao conectar:",
            error
        );

        subscriber = null;

        throw error;
    }
}

module.exports = {
    getSubscriber,
};