const express = require("express");

const { authenticate } = require("../middleware/auth.middleware");
const {
    getRoomMessages,
} = require("../controllers/room.controller");

const router = express.Router();

/**
 * Retorna o histórico de mensagens de uma sala.
 *
 * Exemplo:
 *
 * GET /rooms/:roomId/messages
 */
router.get(
    "/rooms/:roomId/messages",
    authenticate,
    getRoomMessages
);

module.exports = router;
