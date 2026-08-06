/**
 * Controlador responsável pelos endpoints de
 * gerenciamento de salas.
 */
const roomManagementService =
    require("../services/room-management.service");

/**
 * Lista todas as salas.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function listRooms(req, res) {
    try {
        const rooms =
            roomManagementService.listRooms();

        return res.json({
            rooms,
        });
    } catch (error) {
        console.error(
            "[GET /rooms] Erro:",
            error
        );

        return res.status(500).json({
            error: "Erro interno do servidor.",
        });
    }
}

/**
 * Cria uma nova sala.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function createRoom(req, res) {
    try {
        const {
            roomId,
            name,
        } = req.body;

        if (!roomId) {
            return res.status(400).json({
                error: "roomId é obrigatório.",
            });
        }

        if (!name) {
            return res.status(400).json({
                error: "name é obrigatório.",
            });
        }

        const existingRoom =
            roomManagementService.getRoomById(
                roomId
            );

        if (existingRoom) {
            return res.status(409).json({
                error: "roomId já existe.",
            });
        }

        const room =
            roomManagementService.createRoom({
                roomId,
                name,
            });

        return res.status(201).json({
            room,
        });
    } catch (error) {
        console.error(
            "[POST /rooms] Erro:",
            error
        );

        return res.status(500).json({
            error: "Erro interno do servidor.",
        });
    }
}

/**
 * Retorna uma sala pelo ID.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function getRoom(req, res) {
    try {
        const { roomId } = req.params;

        if (!roomId) {
            return res.status(400).json({
                error: "roomId é obrigatório.",
            });
        }

        const room =
            roomManagementService.getRoomById(
                roomId
            );

        if (!room) {
            return res.status(404).json({
                error: "Sala não encontrada.",
            });
        }

        return res.json({
            room,
        });
    } catch (error) {
        console.error(
            `[GET /rooms/${req.params.roomId}] Erro:`,
            error
        );

        return res.status(500).json({
            error: "Erro interno do servidor.",
        });
    }
}

module.exports = {
    listRooms,
    createRoom,
    getRoom,
};
