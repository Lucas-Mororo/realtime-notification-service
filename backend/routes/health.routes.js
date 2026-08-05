const express = require("express");

const {
    getPublisherInstance,
} = require("../redis/publisher");

const {
    getSubscriberInstance,
} = require("../redis/subscriber");

const sseConnectionManager =
    require("../sse/connection-manager");

const router = express.Router();

const CHANNEL =
    process.env.REDIS_CHANNEL || "notifications";

/**
 * Endpoint utilizado para verificar
 * o estado atual da aplicação.
 */
router.get(
    "/health",
    (req, res) => {

        const publisher =
            getPublisherInstance();

        const subscriber =
            getSubscriberInstance();

        return res.json({
            status: "ok",

            clients:
                sseConnectionManager.getCount(),

            channel: CHANNEL,

            redis: {
                publisher:
                    Boolean(
                        publisher?.isOpen
                    ),

                subscriber:
                    Boolean(
                        subscriber?.isOpen
                    ),
            },
        });
    }
);

module.exports = router;