/**
 * Controlador responsável por expor os endpoints
 * relacionados ao histórico de salas.
 */
const roomService =
    require("../services/room.service");
const roomManagementService =
    require("../services/room-management.service");

/**
 * Retorna o histórico de mensagens de uma sala.
 *
 * Query params suportados:
 * - page
 * - limit
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function getRoomMessages(req, res) {

    try {

        const { roomId } = req.params;
        const {
            page = "1",
            limit = "50",
        } = req.query;

        if (!roomId) {
            return res.status(400).json({
                error: "roomId é obrigatório.",
            });
        }

        const room = roomManagementService.getRoomById(roomId);

        if (!room) {
            return res.status(404).json({
                error: "Sala não encontrada.",
            });
        }

        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1
        ) {
            return res.status(400).json({
                error:
                    "page deve ser um inteiro maior ou igual a 1.",
            });
        }

        if (
            !Number.isInteger(limitNumber) ||
            limitNumber < 1 ||
            limitNumber > 100
        ) {
            return res.status(400).json({
                error:
                    "limit deve ser um inteiro entre 1 e 100.",
            });
        }

        const {
            total,
            messages,
        } = roomService.getRoomMessages(
            roomId,
            {
                page: pageNumber,
                limit: limitNumber,
            }
        );

        return res.json({
            roomId,
            page: pageNumber,
            limit: limitNumber,
            total,
            messages,
        });

    } catch (error) {

        console.error(
            `[GET /rooms/${req.params.roomId}/messages] Erro:`,
            error
        );

        return res.status(500).json({
            error: "Erro interno do servidor.",
        });
    }
}

module.exports = {
    getRoomMessages,
};
