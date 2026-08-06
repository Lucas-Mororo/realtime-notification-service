/**
 * Script temporário para validar GET /rooms/:roomId/messages (Etapa 1).
 * Executar com o backend rodando: node backend/tests/validate-messages-endpoint.js
 */
const assert = require("node:assert/strict");

const API_URL = process.env.API_URL || "http://localhost:3000";
const TEST_EMAIL = `validate-${Date.now()}@example.com`;
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
            name: "Validacao",
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

    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const token = login.body.token;
    const authHeaders = {
        Authorization: `Bearer ${token}`,
    };

    const history = await request("/rooms/room-123/messages", {
        headers: authHeaders,
    });

    assert.equal(history.status, 200);
    assert.equal(history.body.roomId, "room-123");
    assert.equal(typeof history.body.total, "number");
    assert.ok(Array.isArray(history.body.messages));
    assert.equal(history.body.page, 1);
    assert.equal(history.body.limit, 50);

    const missingRoom = await request("/rooms/room-999/messages", {
        headers: authHeaders,
    });

    assert.equal(missingRoom.status, 404);
    assert.match(missingRoom.body.error, /Sala não encontrada/i);

    const unauthenticated = await request("/rooms/room-123/messages");

    assert.equal(unauthenticated.status, 401);
    assert.match(unauthenticated.body.error, /Não autenticado/i);

    console.log("[Etapa 1] Validação concluída com sucesso.");
    console.log(`[Etapa 1] room-123 total=${history.body.total}, messages=${history.body.messages.length}`);
}

main().catch((error) => {
    console.error("[Etapa 1] Falha na validação:", error.message);
    process.exit(1);
});
