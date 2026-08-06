/**
 * Serviço responsável pelas operações relacionadas
 * a salas e seu histórico de mensagens.
 */
const messageHistoryService =
    require("./message-history.service");

class RoomService {

    /**
     * Retorna o histórico de mensagens de uma sala.
     *
     * @param {string} roomId
     * @param {Object} [options]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @returns {{ total:number, messages:Object[] }}
     */
    getRoomMessages(roomId, options = {}) {
        return messageHistoryService.getByRoom(
            roomId,
            options
        );
    }
}

module.exports = new RoomService();
