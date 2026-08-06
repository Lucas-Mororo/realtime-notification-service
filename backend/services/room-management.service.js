const roomRepository =
    require("../repositories/room.repository");

/**
 * Serviço responsável pela lógica de salas.
 */
class RoomManagementService {

    /**
     * Lista todas as salas.
     *
     * @returns {Object[]}
     */
    listRooms() {
        return roomRepository.list();
    }

    /**
     * Retorna uma sala pelo ID.
     *
     * @param {string} roomId
     * @returns {Object|null}
     */
    getRoomById(roomId) {
        return roomRepository.getById(roomId);
    }

    /**
     * Cria uma nova sala.
     *
     * @param {Object} payload
     * @param {string} payload.roomId
     * @param {string} payload.name
     * @returns {Object}
     */
    createRoom(payload) {
        const room = {
            roomId: payload.roomId,
            name: payload.name,
            createdAt: new Date().toISOString(),
        };

        return roomRepository.create(room);
    }
}

module.exports = new RoomManagementService();
