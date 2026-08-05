const express = require("express");

const sseConnectionManager =
    require("../sse/connection-manager");

const router = express.Router();

/**
 * Endpoint responsável por estabelecer
 * uma conexão Server-Sent Events.
 *
 * Exemplo:
 *
 * GET /events?userId=lucas&roomId=room-123
 */
router.get(
    "/events",
    (req, res) => {

        const {
            userId,
            roomId,
        } = req.query;

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

        console.log(
            `[SSE] Novo cliente conectado. ` +
            `Usuário: ${userId} | Sala: ${roomId}`
        );

        // ========================================
        // HEADERS SSE
        // ========================================

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.flushHeaders();

        // ========================================
        // REGISTRA CONEXÃO
        // ========================================

        sseConnectionManager.add(
            userId,
            roomId,
            res
        );

        // ========================================
        // EVENTO DE CONEXÃO
        // ========================================

        sseConnectionManager.send(
            res,
            "connection",
            {
                type: "connection",
                message: "Conectado ao servidor SSE",
                userId,
                roomId,
            }
        );

        // ========================================
        // ENCERRAMENTO
        // ========================================

        req.on(
            "close",
            () => {

                console.log(
                    `[SSE] Cliente desconectado. ` +
                    `Usuário: ${userId} | Sala: ${roomId}`
                );

                sseConnectionManager.remove(res);
            }
        );
    }
);

module.exports = router;