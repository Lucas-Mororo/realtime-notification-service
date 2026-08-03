// ========================================
// SSE CONNECTION MANAGER
// ========================================

/**
 * Gerencia todas as conexões SSE abertas
 * pela aplicação.
 *
 * Responsabilidades:
 *
 * - adicionar clientes;
 * - remover clientes;
 * - enviar eventos para um cliente;
 * - enviar eventos para todos os clientes;
 * - enviar heartbeat;
 * - informar quantidade de conexões.
 *
 * A classe não conhece Express, Redis ou
 * regras de negócio.
 *
 * Ela trabalha somente com as conexões HTTP
 * recebidas pelo SSE.
 */
class SSEConnectionManager {

    constructor() {

        /**
         * Set utilizado para armazenar as
         * respostas HTTP das conexões SSE.
         *
         * O Set evita clientes duplicados.
         */
        this.clients = new Set();
    }

    // ========================================
    // ADD CLIENT
    // ========================================

    /**
     * Adiciona uma nova conexão SSE.
     *
     * @param {Response} client
     */
    add(client) {

        this.clients.add(client);

        console.log(
            `[SSE] Cliente adicionado. Total: ${this.clients.size}`
        );
    }

    // ========================================
    // REMOVE CLIENT
    // ========================================

    /**
     * Remove uma conexão SSE.
     *
     * @param {Response} client
     */
    remove(client) {

        this.clients.delete(client);

        console.log(
            `[SSE] Cliente removido. Total: ${this.clients.size}`
        );
    }

    // ========================================
    // COUNT
    // ========================================

    /**
     * Retorna a quantidade atual
     * de conexões SSE.
     *
     * @returns {number}
     */
    getCount() {

        return this.clients.size;
    }

    // ========================================
    // SEND
    // ========================================

    /**
     * Envia um evento SSE para um único cliente.
     *
     * Formato:
     *
     * event: notification
     * data: {...}
     *
     * @param {Response} client
     * @param {string} event
     * @param {object|string} data
     */
    send(client, event, data) {

        try {

            const payload =
                typeof data === "string"
                    ? data
                    : JSON.stringify(data);

            client.write(
                `event: ${event}\n`
            );

            client.write(
                `data: ${payload}\n\n`
            );

        } catch (error) {

            console.error(
                "[SSE] Erro ao enviar evento:",
                error
            );

            this.remove(client);
        }
    }

    // ========================================
    // BROADCAST
    // ========================================

    /**
     * Envia um evento para todos os clientes
     * SSE atualmente conectados.
     *
     * @param {string} event
     * @param {object|string} data
     */
    broadcast(event, data) {

        for (const client of this.clients) {

            this.send(
                client,
                event,
                data
            );
        }
    }

    // ========================================
    // HEARTBEAT
    // ========================================

    /**
     * Envia um comentário SSE para todas
     * as conexões abertas.
     *
     * Comentários SSE começam com ":".
     *
     * Exemplo:
     *
     * : heartbeat
     *
     * O navegador recebe os bytes, mas não
     * dispara nenhum evento EventSource.
     */
    heartbeat() {

        for (const client of this.clients) {

            try {

                client.write(
                    ": heartbeat\n\n"
                );

            } catch (error) {

                console.error(
                    "[SSE] Erro no heartbeat:",
                    error
                );

                this.remove(client);
            }
        }
    }

    // ========================================
    // CLOSE ALL
    // ========================================

    /**
     * Encerra todas as conexões SSE.
     *
     * Utilizado durante o graceful shutdown
     * da aplicação.
     */
    closeAll() {

        for (const client of this.clients) {

            try {

                client.end();

            } catch (error) {

                console.error(
                    "[SSE] Erro ao fechar cliente:",
                    error
                );
            }
        }

        this.clients.clear();

        console.log(
            "[SSE] Todas as conexões foram encerradas."
        );
    }
}

// ========================================
// SINGLETON
// ========================================

/**
 * Exportamos uma única instância do manager.
 *
 * Dessa maneira, todos os módulos da aplicação
 * que importarem este arquivo utilizarão o
 * mesmo Set de conexões.
 */
const sseConnectionManager =
    new SSEConnectionManager();

module.exports = sseConnectionManager;
