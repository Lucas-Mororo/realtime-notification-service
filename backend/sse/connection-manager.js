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
         *   userId,
         *   Set<ServerResponse>
         * >
         *
         * Exemplo:
         *
         * {
         *     "lucas" -> Set(res1, res2),
         *     "pedro" -> Set(res3)
         * }
         */
        this.connections = new Map();

        /**
         * Armazena os usuários pertencentes
         * a cada sala.
         *
         * Estrutura:
         *
         * Map<
         *   roomId,
         *   Set<userId>
         * >
         */
        this.rooms = new Map();
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
    add(userId, roomId, client) {

        if (!this.connections.has(userId)) {

            this.connections.set(
                userId,
                new Set()
            );
        }

        this.connections.get(userId).add(client);

        if (!this.rooms.has(roomId)) {

            this.rooms.set(
                roomId,
                new Set()
            );
        }

        this.rooms.get(roomId).add(userId);

        console.log(
            `[SSE] Usuário ${userId} entrou na sala ${roomId}.`
        );

        console.log(
            `[SSE] Usuários na sala ${roomId}:`,
            this.rooms.get(roomId).size
        );
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
     * @param {Response} client
     */
    remove(userId, roomId, client) {

        const userConnections =
            this.connections.get(userId);

        if (userConnections) {
            userConnections.delete(client);

            if (userConnections.size === 0) {
                this.connections.delete(userId);
            }
        }

        const roomUsers =
            this.rooms.get(roomId);

        if (roomUsers) {
            roomUsers.delete(userId);

            if (roomUsers.size === 0) {
                this.rooms.delete(roomId);
            }
        }

        console.log(
            `[SSE] Usuário ${userId} saiu da sala ${roomId}.`
        );
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

        for (const userClients of this.connections.values()) {
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
            this.connections.get(userId);

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

            if (!client || typeof client.write !== "function") {

                console.error(
                    "[SSE] Cliente inválido:",
                    client
                );

                return;
            }

            const payload =
                typeof data === "string"
                    ? data
                    : JSON.stringify(data);

            client.write(`event: ${event}\n`);
            client.write(`data: ${payload}\n\n`);

        } catch (error) {

            console.error(
                "[SSE] Erro ao enviar evento:",
                error
            );

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
            this.connections.get(userId);

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
    broadcast(roomId, event, data) {
        const users =
            this.rooms.get(roomId);

        if (!users) {
            return;
        }

        for (const userId of users) {
            const clients =
                this.connections.get(userId);

            if (!clients) {
                continue;
            }

            for (const client of clients) {
                this.send(client, event, data);
            }
        }
    }

    // ========================================
    // ROOMS
    // ========================================

    /**
     * Adiciona um usuário a uma sala.
     *
     * @param {string} roomId
     * @param {string} userId
     */
    joinRoom(roomId, userId) {

        if (!this.rooms.has(roomId)) {
            this.rooms.set(
                roomId,
                new Set()
            );
        }

        const roomUsers =
            this.rooms.get(roomId);

        roomUsers.add(userId);

        console.log(
            `[SSE] Usuário ${userId} entrou na sala ${roomId}.`
        );

        console.log(
            `[SSE] Usuários na sala: ${roomUsers.size}`
        );
    }

    /**
     * Remove um usuário de uma sala.
     *
     * Se a sala ficar vazia, ela também será
     * removida do Map.
     *
     * @param {string} roomId
     * @param {string} userId
     */
    leaveRoom(roomId, userId) {

        const roomUsers =
            this.rooms.get(roomId);

        if (!roomUsers) {
            return;
        }

        roomUsers.delete(userId);

        if (roomUsers.size === 0) {
            this.rooms.delete(roomId);
        }

        console.log(
            `[SSE] Usuário ${userId} saiu da sala ${roomId}.`
        );
    }

    /**
     * Envia um evento para todos os usuários
     * conectados a uma determinada sala.
     *
     * @param {string} roomId
     * @param {string} event
     * @param {object|string} data
     */
    broadcastToRoom(roomId, event, data) {

        const roomUsers =
            this.rooms.get(roomId);

        if (!roomUsers) {

            console.log(
                `[SSE] Sala ${roomId} não possui usuários conectados.`
            );

            return;
        }

        for (const userId of roomUsers) {

            this.sendToUser(
                userId,
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
        for (const clients of this.connections.values()) {

            for (const client of clients) {

                try {

                    client.write(": heartbeat\n\n");

                } catch (error) {

                    console.error(
                        "[SSE] Erro no heartbeat:",
                        error
                    );

                    this.remove(client);
                }
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

        for (const clients of this.connections.values()) {

            for (const client of clients) {

                try {

                    client.end();

                } catch (error) {

                    console.error(
                        "[SSE] Erro ao fechar cliente:",
                        error
                    );
                }
            }
        }

        this.connections.clear();

        this.rooms.clear();

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
const sseConnectionManager = new SSEConnectionManager();

module.exports = sseConnectionManager;
