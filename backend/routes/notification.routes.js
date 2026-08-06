const express = require("express");

const { authenticate } = require("../middleware/auth.middleware");
const {
    publishNotification,
} = require("../controllers/notification.controller");

const router = express.Router();

/**
 * Publica uma mensagem no Redis.
 *
 * Fluxo:
 *
 * HTTP
 *   ↓
 * Controller
 *   ↓
 * Service
 *   ↓
 * Redis Publisher
 *   ↓
 * Redis Pub/Sub
 */
router.post(
    "/notify",
    authenticate,
    publishNotification
);

module.exports = router;