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
         * Armazena as conexões SSE agrupadas por usuário.
         *
         * Estrutura:
         *
         * Map<
         *     userId,
         *     Set<Response>
         * >
         *
         * Um usuário pode possuir várias conexões
         * simultâneas.
         */
        this.clients = new Map();
    }

    // ========================================
    // ADD CLIENT
    // ========================================

    /**
     * Adiciona uma conexão SSE para um usuário.
     *
     * Um mesmo usuário pode possuir múltiplas
     * conexões simultâneas.
     *
     * @param {string} userId
     * @param {Response} client
     */
    add(userId, client) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }

        const userClients = this.clients.get(userId);

        userClients.add(client);

        console.log(`[SSE] Conexão adicionada para usuário ${userId}.`);

        console.log(`[SSE] Conexões totais: ${this.getCount()}`);
    }

    // ========================================
    // REMOVE CLIENT
    // ========================================

    /**
     * Remove uma conexão SSE de um usuário.
     *
     * Se o usuário não possuir mais conexões,
     * ele também será removido do Map.
     *
     * @param {string} userId
     * @param {Response} client
     */
    remove(userId, client) {
        const userClients = this.clients.get(userId);

        if (!userClients) {
            return;
        }

        userClients.delete(client);

        /**
         * Se não existem mais conexões para esse
         * usuário, removemos o usuário do Map.
         */
        if (userClients.size === 0) {
            this.clients.delete(userId);
        }

        console.log(`[SSE] Conexão removida do usuário ${userId}.`);

        console.log(`[SSE] Conexões totais: ${this.getCount()}`);
    }

    // ========================================
    // COUNT
    // ========================================

    /**
     * Retorna a quantidade total de conexões SSE.
     *
     * @returns {number}
    */
    getCount() {

        let count = 0;

        for (const userClients of this.clients.values()) {
            count += userClients.size;
        }

        return count;
    }

    /**
     * Retorna a quantidade de conexões de um usuário.
     *
     * @param {string} userId
     * @returns {number}
     */
    getUserConnectionCount(userId) {

        const userClients =
            this.clients.get(userId);

        if (!userClients) {
            return 0;
        }

        return userClients.size;
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
            const payload = typeof data === "string" ? data : JSON.stringify(data);

            client.write(`event: ${event}\n`);

            client.write(`data: ${payload}\n\n`);
        } catch (error) {
            console.error("[SSE] Erro ao enviar evento:", error);

            this.remove(client);
        }
    }

    /**
     * Envia um evento SSE somente para as conexões
     * pertencentes a um determinado usuário.
     *
     * @param {string} userId
     * @param {string} event
     * @param {object|string} data
     */
    sendToUser(userId, event, data) {

        const userClients =
            this.clients.get(userId);

        /**
         * Usuário não possui nenhuma conexão ativa.
         */
        if (!userClients) {

            console.log(
                `[SSE] Usuário ${userId} não possui conexões ativas.`
            );

            return;
        }

        /**
         * Envia o evento para todas as conexões
         * desse usuário.
         *
         * Isso significa que se Lucas estiver
         * conectado em duas abas, as duas receberão
         * a notificação.
         */
        for (const client of userClients) {

            this.send(
                client,
                event,
                data
            );
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
            this.send(client, event, data);
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
                client.write(": heartbeat\n\n");
            } catch (error) {
                console.error("[SSE] Erro no heartbeat:", error);

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
                console.error("[SSE] Erro ao fechar cliente:", error);
            }
        }

        this.clients.clear();

        console.log("[SSE] Todas as conexões foram encerradas.");
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
const sseConnectionManager = new SSEConnectionManager();

module.exports = sseConnectionManager;
