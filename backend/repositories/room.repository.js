const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const storagePath = path.join(dataDir, "rooms.json");

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(
        storagePath,
        JSON.stringify({ rooms: [] }, null, 2),
        "utf-8"
    );
}

/**
 * Repositório responsável pelo armazenamento
 * persistente de salas em arquivo JSON.
 */
class RoomRepository {

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
     * Lista todas as salas.
     *
     * @returns {Object[]}
     */
    list() {
        const storage = this.loadStorage();
        return storage.rooms;
    }

    /**
     * Retorna uma sala pelo ID.
     *
     * @param {string} roomId
     * @returns {Object|null}
     */
    getById(roomId) {
        const storage = this.loadStorage();
        return (
            storage.rooms.find(
                (room) => room.roomId === roomId
            ) || null
        );
    }

    /**
     * Cria uma nova sala.
     *
     * @param {Object} room
     * @returns {Object}
     */
    create(room) {
        const storage = this.loadStorage();

        storage.rooms.push(room);
        this.saveStorage(storage);

        return room;
    }

    /**
     * Verifica se a sala existe.
     *
     * @param {string} roomId
     * @returns {boolean}
     */
    exists(roomId) {
        return Boolean(this.getById(roomId));
    }
}

module.exports = new RoomRepository();
