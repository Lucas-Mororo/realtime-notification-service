const {
    getPublisher,
} = require("../redis/publisher");

const CHANNEL =
    process.env.REDIS_CHANNEL || "notifications";

/**
 * Serviço responsável por publicar
 * notificações no Redis.
 *
 * Nenhuma camada acima precisa conhecer
 * Redis ou o canal utilizado.
 */
class NotificationService {

    /**
     * Publica uma mensagem.
     *
     * @param {Object} params
     * @param {string} params.userId
     * @param {string} params.roomId
     * @param {string} params.message
     */
    async publish({
        type,
        userId,
        roomId,
        message,
    }) {

        const notification = {
            type,
            roomId,
            userId,
            message: message.trim(),
            timestamp: new Date().toISOString(),
        };

        const publisher =
            await getPublisher();

        await publisher.publish(
            CHANNEL,
            JSON.stringify(notification)
        );

        console.log(
            "[Redis Publisher] Mensagem publicada:",
            notification
        );

        return notification;
    }

}

module.exports =
    new NotificationService();