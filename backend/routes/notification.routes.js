const express = require("express");

const router = express.Router();

const notificationService =
    require("../services/notification.service");

/**
 * Publica uma mensagem no Redis.
 *
 * Fluxo:
 *
 * HTTP
 *   ↓
 * Route
 *   ↓
 * Redis Publisher
 *   ↓
 * Redis Pub/Sub
 */
router.post(
    "/notify",
    async (req, res) => {

        try {

            const {
                userId,
                roomId,
                message,
            } = req.body;

            // ========================================
            // VALIDAÇÃO
            // ========================================

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

            if (
                typeof message !== "string" ||
                !message.trim()
            ) {
                return res.status(400).json({
                    error: "A mensagem é obrigatória.",
                });
            }

            // ========================================
            // PAYLOAD
            // ========================================

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
);

module.exports = router;