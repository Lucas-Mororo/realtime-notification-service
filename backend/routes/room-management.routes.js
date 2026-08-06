const express = require("express");

const { authenticate } = require("../middleware/auth.middleware");
const {
    listRooms,
    createRoom,
    getRoom,
} = require("../controllers/room-management.controller");

const router = express.Router();

/**
 * Lista todas as salas.
 */
router.get(
    "/rooms",
    authenticate,
    listRooms
);

/**
 * Cria uma nova sala.
 */
router.post(
    "/rooms",
    authenticate,
    createRoom
);

/**
 * Retorna uma sala específica.
 */
router.get(
    "/rooms/:roomId",
    authenticate,
    getRoom
);

module.exports = router;
