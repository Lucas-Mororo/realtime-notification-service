const { createClient } = require("redis");

const REDIS_URL =
    process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Instância Singleton do Redis Subscriber.
 *
 * Essa conexão será utilizada exclusivamente
 * para receber mensagens publicadas no Redis.
 */
let subscriber = null;

/**
 * Retorna a instância atual do Subscriber.
 *
 * Não cria conexão e não realiza conexão com Redis.
 *
 * Retorna:
 *
 * - Redis client, caso exista;
 * - null, caso ainda não tenha sido criado.
 */
function getSubscriberInstance() {
    return subscriber;
}

/**
 * Retorna o Redis Subscriber conectado.
 *
 * Na primeira chamada:
 *
 * 1. Cria o cliente Redis.
 * 2. Configura tratamento de erros.
 * 3. Conecta ao Redis.
 *
 * Nas chamadas seguintes:
 *
 * - Reutiliza a mesma instância Singleton.
 */
async function getSubscriber() {

    if (subscriber) {
        return subscriber;
    }

    subscriber = createClient({
        url: REDIS_URL,
    });

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

/**
 * Fecha a conexão do Subscriber.
 *
 * Essa função é utilizada durante o graceful shutdown
 * da aplicação.
 */
async function closeSubscriber() {

    const instance =
        getSubscriberInstance();

    if (!instance) {
        return;
    }

    if (instance.isOpen) {

        await instance.quit();

        console.log(
            "[Redis Subscriber] Conexão encerrada."
        );
    }

    subscriber = null;
}

module.exports = {
    getSubscriber,
    getSubscriberInstance,
    closeSubscriber,
};