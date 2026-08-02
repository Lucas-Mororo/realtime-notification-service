const { createClient } = require("redis");

const REDIS_URL =
    process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Instância Singleton do Redis Publisher.
 *
 * Mantemos essa variável fora da função para que
 * todas as chamadas de getPublisher() reutilizem
 * a mesma conexão Redis.
 */
let publisher = null;

/**
 * Retorna a instância única do Redis Publisher.
 *
 * Na primeira chamada:
 * - cria o cliente;
 * - configura tratamento de erros;
 * - conecta ao Redis.
 *
 * Nas chamadas seguintes:
 * - retorna a conexão já existente.
 */
async function getPublisher() {

    if (publisher) {
        return publisher;
    }

    publisher = createClient({
        url: REDIS_URL,
    });

    /**
     * Trata erros que podem acontecer
     * durante a utilização do Redis.
     */
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

        /**
         * Se a conexão falhar, descartamos
         * a instância para permitir uma nova
         * tentativa posteriormente.
         */
        publisher = null;

        throw error;
    }
}

module.exports = {
    getPublisher,
};