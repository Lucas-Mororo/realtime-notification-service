const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
const databasePath = path.join(dataDir, "chat.db");

fs.mkdirSync(dataDir, {
    recursive: true,
});

const db = new Database(databasePath);

/**
 * Inicializa as tabelas básicas do banco de dados.
 */
function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            room_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL
        );
    `);
}

initializeDatabase();

module.exports = db;
