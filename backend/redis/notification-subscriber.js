const { getSubscriber } = require("./subscriber");

const sseConnectionManager =
    require("../sse/connection-manager");

const CHANNEL =
    process.env.REDIS_CHANNEL ||
    "notifications";

/**
 * Inicializa o consumidor responsável
 * por receber mensagens do Redis
 * e distribuí-las via SSE.
 */
async function startNotificationSubscriber() {

    const subscriber =
        await getSubscriber();

    await subscriber.subscribe(
        CHANNEL,
        (message) => {

            console.log(
                "[Redis Subscriber] Mensagem recebida:",
                message
            );

            try {

                const notification =
                    JSON.parse(message);

                if (!notification.roomId) {

                    console.warn(
                        "[Redis Subscriber] Mensagem ignorada: roomId ausente."
                    );

                    return;
                }

                sseConnectionManager.broadcast(
                    notification.roomId,
                    "notification",
                    notification
                );

            } catch (error) {

                console.error(
                    "[Redis Subscriber] Erro ao processar mensagem:",
                    error
                );
            }

        }
    );

    console.log(
        `[Redis Subscriber] Escutando canal "${CHANNEL}".`
    );

}

module.exports = {
    startNotificationSubscriber,
};