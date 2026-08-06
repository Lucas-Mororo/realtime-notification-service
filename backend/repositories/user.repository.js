const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const storagePath = path.join(dataDir, "users.json");

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(storagePath, JSON.stringify({ users: [] }, null, 2), "utf-8");
}

class UserRepository {
    constructor() {
        this.storagePath = storagePath;
    }

    loadStorage() {
        const content = fs.readFileSync(this.storagePath, "utf-8");
        return JSON.parse(content);
    }

    saveStorage(data) {
        fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), "utf-8");
    }

    getByEmail(email) {
        const storage = this.loadStorage();
        return storage.users.find((user) => user.email === email) || null;
    }

    getById(userId) {
        const storage = this.loadStorage();
        return storage.users.find((user) => user.userId === userId) || null;
    }

    create(user) {
        const storage = this.loadStorage();
        storage.users.push(user);
        this.saveStorage(storage);
        return user;
    }
}

module.exports = new UserRepository();
