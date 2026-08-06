/**
 * Verifica log correto de save() após envio de mensagem (Etapa 2).
 * Executar com backend rodando: node backend/tests/verify-save-log.js
 */
const assert = require("node:assert/strict");

const API_URL = process.env.API_URL || "http://localhost:3000";
const TEST_EMAIL = `save-log-${Date.now()}@example.com`;
const TEST_PASSWORD = "Senha123!";

async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, options);
    const body = await response.json().catch(() => null);

    return {
        status: response.status,
        body,
    };
}

async function main() {
    await request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Save Log",
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        }),
    });

    const login = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        }),
    });

    const before = await request("/rooms/room-123/messages", {
        headers: {
            Authorization: `Bearer ${login.body.token}`,
        },
    });

    const notify = await request("/notify", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${login.body.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userId: login.body.user.userId,
            roomId: "room-123",
            message: "teste log total",
        }),
    });

    assert.equal(notify.status, 200);

    const after = await request("/rooms/room-123/messages", {
        headers: {
            Authorization: `Bearer ${login.body.token}`,
        },
    });

    assert.equal(after.body.total, before.body.total + 1);
    console.log(
        `[Etapa 2] Total room-123: ${before.body.total} -> ${after.body.total}`
    );
}

main().catch((error) => {
    console.error("[Etapa 2] Falha:", error.message);
    process.exit(1);
});
