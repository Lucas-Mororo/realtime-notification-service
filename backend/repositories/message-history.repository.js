const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const storagePath = process.env.MESSAGES_STORAGE_PATH
    ? path.resolve(process.env.MESSAGES_STORAGE_PATH)
    : path.join(dataDir, "messages.json");

const storageDir = path.dirname(storagePath);

if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}

if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(
        storagePath,
        JSON.stringify({ messages: [] }, null, 2)
    );
}

/**
 * Repositório responsável pelo armazenamento
 * do histórico de mensagens em arquivo JSON.
 *
 * Essa implementação mantém persistência local
 * sem depender de dependências nativas.
 */
class MessageHistoryRepository {

    constructor() {
        this.storagePath = storagePath;
    }

    loadStorage() {
        const content = fs.readFileSync(
            this.storagePath,
            "utf-8"
        );

        return JSON.parse(content);
    }

    saveStorage(data) {
        fs.writeFileSync(
            this.storagePath,
            JSON.stringify(data, null, 2),
            "utf-8"
        );
    }

    /**
     * Salva uma notificação no histórico da sala.
     *
     * @param {Object} notification
     * @param {string} notification.roomId
     * @returns {{ message:Object, total:number }}
     */
    save(notification) {
        const storage = this.loadStorage();

        const message = {
            id: storage.messages.length + 1,
            ...notification,
        };

        storage.messages.push(message);
        this.saveStorage(storage);

        const total = storage.messages.filter(
            (item) => item.roomId === notification.roomId
        ).length;

        return {
            message,
            total,
        };
    }

    /**
     * Retorna o histórico de uma sala.
     *
     * @param {string} roomId
     * @param {Object} [options]
     * @param {number} [options.page=1]
     * @param {number} [options.limit=50]
     * @returns {{ total:number, messages:Object[] }}
     */
    getByRoom(roomId, options = {}) {
        const storage = this.loadStorage();
        const allMessages = storage.messages.filter(
            (message) => message.roomId === roomId
        );

        const page = options.page || 1;
        const limit = options.limit || 50;
        const offset = (page - 1) * limit;

        return {
            total: allMessages.length,
            messages: allMessages.slice(
                offset,
                offset + limit
            ),
        };
    }

    /**
     * Remove o histórico de uma sala.
     *
     * @param {string} roomId
     */
    clear(roomId) {
        const storage = this.loadStorage();

        storage.messages = storage.messages.filter(
            (message) => message.roomId !== roomId
        );

        this.saveStorage(storage);
    }

    /**
     * Remove todo o histórico.
     */
    clearAll() {
        this.saveStorage({ messages: [] });
    }
}

module.exports = new MessageHistoryRepository();
