const messageHistoryRepository =
    require("../repositories/message-history.repository");

/**
 * Serviço responsável por armazenar
 * o histórico das mensagens.
 *
 * Essa camada existe para manter a separação
 * entre regras de aplicação e acesso a dados.
 */
class MessageHistoryService {

    /**
     * Salva uma nova mensagem.
     *
     * @param {Object} notification
     * @returns {Object}
     */
    save(notification) {
        const {
            message,
            total,
        } = messageHistoryRepository.save(
            notification
        );

        console.log(
            `[History] Mensagem salva na sala ${notification.roomId}. Total: ${total}`
        );

        return message;
    }

    /**
     * Retorna todas as mensagens
     * de uma sala.
     *
     * @param {string} roomId
     * @param {Object} [options]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @returns {{ total:number, messages:Object[] }}
     */
    getByRoom(roomId, options = {}) {
        return messageHistoryRepository.getByRoom(
            roomId,
            options
        );
    }

    /**
     * Remove o histórico de uma sala.
     *
     * @param {string} roomId
     */
    clear(roomId) {
        messageHistoryRepository.clear(roomId);
    }

    /**
     * Remove todo o histórico.
     */
    clearAll() {
        messageHistoryRepository.clearAll();
    }
}

module.exports =
    new MessageHistoryService();