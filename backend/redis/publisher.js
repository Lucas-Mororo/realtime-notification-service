const { createClient } = require("redis");

const REDIS_URL =
    process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Instância Singleton do Redis Publisher.
 *
 * Essa variável mantém a única conexão Publisher
 * utilizada pela aplicação.
 */
let publisher = null;

/**
 * Retorna a instância atual do Publisher.
 *
 * Diferentemente de getPublisher(), esta função
 * não cria nem conecta uma nova instância.
 *
 * Retorna:
 *
 * - Redis client, caso exista;
 * - null, caso ainda não tenha sido criado.
 */
function getPublisherInstance() {
    return publisher;
}

/**
 * Retorna o Redis Publisher conectado.
 *
 * Na primeira chamada:
 *
 * 1. Cria o cliente Redis.
 * 2. Registra tratamento de erros.
 * 3. Estabelece conexão.
 *
 * Nas chamadas seguintes:
 *
 * - Reutiliza a mesma instância Singleton.
 */
async function getPublisher() {

    if (publisher) {
        return publisher;
    }

    publisher = createClient({
        url: REDIS_URL,
    });

    publisher.on("error", (error) => {
        console.error(
            "[Redis Publisher] Erro:",
            error
        );
    });

    try {

        await publisher.connect();

        console.log(
            "[Redis Publisher] Conectado ao Redis."
        );

        return publisher;

    } catch (error) {

        console.error(
            "[Redis Publisher] Falha ao conectar:",
            error
        );

        publisher = null;

        throw error;
    }
}

/**
 * Fecha a conexão do Publisher.
 *
 * Essa função é utilizada durante o graceful shutdown
 * da aplicação.
 */
async function closePublisher() {

    const instance =
        getPublisherInstance();

    if (!instance) {
        return;
    }

    if (instance.isOpen) {

        await instance.quit();

        console.log(
            "[Redis Publisher] Conexão encerrada."
        );
    }

    publisher = null;
}

module.exports = {
    getPublisher,
    getPublisherInstance,
    closePublisher,
};