// ========================================
// SSE CONNECTION MANAGER
// ========================================
/**
 * Gerencia todas as conexões SSE abertas
 * pela aplicação.
 *
 * Responsabilidades:
 *
 * - adicionar conexões;
 * - remover conexões;
 * - enviar eventos para um cliente;
 * - enviar eventos para um usuário;
 * - enviar eventos para uma sala;
 * - enviar heartbeat;
 * - informar quantidade de conexões;
 * - encerrar todas as conexões.
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
         * Fonte de verdade das conexões SSE.
         *
         * Cada ServerResponse é associado aos
         * metadados da conexão.
         *
         * Estrutura:
         *
         * Map<
         *     ServerResponse,
         *     {
         *         userId: string,
         *         roomId: string
         *     }
         * >
         *
         * Exemplo:
         *
         * res1 -> {
         *     userId: "lucas",
         *     roomId: "room-123"
         * }
         *
         * res2 -> {
         *     userId: "pedro",
         *     roomId: "room-123"
         * }
         */
        this.connections = new Map();

        /**
         * Índice das conexões agrupadas por sala.
         *
         * Essa estrutura existe para tornar o
         * broadcast por sala direto.
         *
         * Estrutura:
         *
         * Map<
         *     roomId,
         *     Set<ServerResponse>
         * >
         *
         * Exemplo:
         *
         * room-123 -> Set(res1, res2)
         * room-999 -> Set(res3)
         */
        this.rooms = new Map();
    }

    // ========================================
    // ADD CONNECTION
    // ========================================
    /**
     * Adiciona uma conexão SSE.
     *
     * A própria operação add() registra:
     *
     * userId
     *     ↓
     * roomId
     *     ↓
     * res
     *
     * Não é necessário chamar joinRoom()
     * separadamente.
     *
     * Um mesmo usuário pode possuir múltiplas
     * conexões simultâneas.
     *
     * @param {string} userId
     * @param {string} roomId
     * @param {Response} client
     */
    add(userId, roomId, client) {
        if (
            !userId ||
            !roomId ||
            !client
        ) {
            console.error(
                "[SSE] Não foi possível adicionar conexão inválida."
            );

            return;
        }

        /**
         * Registra a conexão e seus metadados.
         */
        this.connections.set(client, {
            userId,
            roomId,
        });

        /**
         * Cria o Set da sala caso ainda não exista.
         */
        if (!this.rooms.has(roomId)) {
            this.rooms.set(
                roomId,
                new Set()
            );
        }

        /**
         * Adiciona a conexão ao índice da sala.
         */
        this.rooms
            .get(roomId)
            .add(client);

        console.log(
            `[SSE] Usuário ${userId} entrou na sala ${roomId}.`
        );

        console.log(
            `[SSE] Conexões na sala ${roomId}:`,
            this.rooms.get(roomId).size
        );
    }

    // ========================================
    // REMOVE CONNECTION
    // ========================================
    /**
     * Remove uma conexão SSE.
     *
     * A conexão é removida:
     *
     * 1. Do Map principal de conexões.
     * 2. Do Set da sala.
     *
     * Se a sala ficar vazia, ela também será
     * removida.
     *
     * @param {Response} client
     */
    remove(client) {
        const connection =
            this.connections.get(client);

        if (!connection) {
            return;
        }

        const {
            userId,
            roomId,
        } = connection;

        /**
         * Remove a conexão da fonte de verdade.
         */
        this.connections.delete(client);

        /**
         * Remove a conexão do índice da sala.
         */
        const roomClients =
            this.rooms.get(roomId);

        if (roomClients) {
            roomClients.delete(client);

            /**
             * Não mantemos salas vazias em memória.
             */
            if (roomClients.size === 0) {
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
        return this.connections.size;
    }

    /**
     * Retorna a quantidade de conexões de um usuário.
     *
     * Como um usuário pode possuir múltiplas abas,
     * precisamos percorrer as conexões.
     *
     * @param {string} userId
     * @returns {number}
     */
    getUserConnectionCount(userId) {
        let count = 0;

        for (const connection of this.connections.values()) {
            if (connection.userId === userId) {
                count++;
            }
        }

        return count;
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
            if (
                !client ||
                typeof client.write !== "function"
            ) {
                console.error(
                    "[SSE] Cliente inválido."
                );

                return;
            }

            /**
             * Evita escrever em uma conexão
             * que já foi encerrada.
             */
            if (client.writableEnded) {
                this.remove(client);
                return;
            }

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

            /**
             * Agora remove() recebe somente o client.
             *
             * O Manager consegue descobrir
             * userId e roomId através de connections.
             */
            this.remove(client);
        }
    }

    // ========================================
    // SEND TO USER
    // ========================================
    /**
     * Envia um evento SSE para todas as conexões
     * pertencentes a determinado usuário.
     *
     * @param {string} userId
     * @param {string} event
     * @param {object|string} data
     */
    sendToUser(userId, event, data) {
        for (const [
            client,
            connection,
        ] of this.connections.entries()) {

            if (connection.userId !== userId) {
                continue;
            }

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
     * Envia um evento somente para as conexões
     * pertencentes a determinada sala.
     *
     * O ponto importante aqui é que o broadcast
     * trabalha diretamente com:
     *
     * roomId -> Set<ServerResponse>
     *
     * Portanto não precisamos fazer:
     *
     * roomId
     *    ↓
     * userId
     *    ↓
     * connections
     *
     * Isso evita enviar mensagens para outras
     * conexões do mesmo usuário que estejam
     * em outra sala.
     *
     * @param {string} roomId
     * @param {string} event
     * @param {object|string} data
     */
    broadcast(roomId, event, data) {
        if (!roomId) {
            console.warn(
                "[SSE] Broadcast ignorado: roomId ausente."
            );

            return;
        }

        const roomClients =
            this.rooms.get(roomId);

        if (!roomClients) {
            console.log(
                `[SSE] Nenhuma conexão ativa na sala ${roomId}.`
            );

            return;
        }

        console.log(
            `[SSE] Broadcast para sala ${roomId}. ` +
            `Conexões: ${roomClients.size}`
        );

        /**
         * O Set contém diretamente ServerResponse.
         *
         * Portanto cada client possui .write().
         */
        for (const client of roomClients) {
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
        /**
         * connections possui ServerResponse
         * diretamente como chave.
         *
         * Portanto não precisamos percorrer
         * Maps/Sets aninhados.
         */
        for (const client of this.connections.keys()) {
            try {
                if (client.writableEnded) {
                    this.remove(client);
                    continue;
                }

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
        /**
         * connections possui os ServerResponse
         * diretamente como chave.
         */
        for (const client of this.connections.keys()) {
            try {
                if (!client.writableEnded) {
                    client.end();
                }

            } catch (error) {
                console.error(
                    "[SSE] Erro ao fechar cliente:",
                    error
                );
            }
        }

        /**
         * Limpa todos os índices em memória.
         */
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
 * mesmo Map de conexões.
 */
const sseConnectionManager =
    new SSEConnectionManager();

module.exports =
    sseConnectionManager;