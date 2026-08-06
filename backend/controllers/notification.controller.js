/**
 * Controlador responsável por expor os endpoints
 * de notificação para o Express.
 */
const notificationService =
    require("../services/notification.service");
const roomManagementService =
    require("../services/room-management.service");

/**
 * Publica uma mensagem no Redis e no histórico.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function publishNotification(req, res) {

    try {

        const {
            userId,
            roomId,
            message,
        } = req.body;

        if (!userId) {
            return res.status(400).json({
                error: "userId é obrigatório.",
            });
        }

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

        if (
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                error: "A mensagem é obrigatória.",
            });
        }

        await notificationService.publish({
            type: "message",
            userId,
            roomId,
            message,
        });

        return res.json({
            success: true,
            message: "Mensagem publicada.",
        });

    } catch (error) {

        console.error(
            "[POST /notify] Erro:",
            error
        );

        return res.status(500).json({
            error: "Erro interno do servidor.",
        });
    }
}

module.exports = {
    publishNotification,
};
