/**
 * Checklist final da Fase 3 — histórico de mensagens.
 * Executar com o backend rodando: node backend/tests/fase3-checklist.js
 */
const assert = require("node:assert/strict");

const API_URL = process.env.API_URL || "http://localhost:3000";
const TEST_EMAIL = `fase3-checklist-${Date.now()}@example.com`;
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
            name: "Checklist Fase 3",
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

    const token = login.body.token;
    const authHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };

    const unauthenticated = await request(
        "/rooms/room-123/messages"
    );
    assert.equal(unauthenticated.status, 401);

    const missingRoom = await request(
        "/rooms/room-999/messages",
        { headers: authHeaders }
    );
    assert.equal(missingRoom.status, 404);

    const emptyRoomId = `room-empty-${Date.now()}`;

    await request("/rooms", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            roomId: emptyRoomId,
            name: "Sala vazia",
        }),
    });

    const emptyRoom = await request(
        `/rooms/${emptyRoomId}/messages`,
        { headers: authHeaders }
    );

    assert.equal(emptyRoom.status, 200);
    assert.equal(emptyRoom.body.total, 0);
    assert.deepEqual(emptyRoom.body.messages, []);

    const roomA = `room-a-${Date.now()}`;
    const roomB = `room-b-${Date.now()}`;

    for (const room of [roomA, roomB]) {
        await request("/rooms", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                roomId: room,
                name: room,
            }),
        });
    }

    await request("/notify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            userId: login.body.user.userId,
            roomId: roomA,
            message: "isolamento A",
        }),
    });

    await request("/notify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            userId: login.body.user.userId,
            roomId: roomB,
            message: "isolamento B",
        }),
    });

    const historyA = await request(
        `/rooms/${roomA}/messages`,
        { headers: authHeaders }
    );
    const historyB = await request(
        `/rooms/${roomB}/messages`,
        { headers: authHeaders }
    );

    assert.equal(historyA.body.total, 1);
    assert.equal(historyA.body.messages[0].message, "isolamento A");
    assert.equal(historyB.body.total, 1);
    assert.equal(historyB.body.messages[0].message, "isolamento B");

    const paginationRoom = `room-pagination-${Date.now()}`;

    await request("/rooms", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
            roomId: paginationRoom,
            name: "Paginação",
        }),
    });

    for (let index = 1; index <= 5; index += 1) {
        await request("/notify", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                userId: login.body.user.userId,
                roomId: paginationRoom,
                message: `msg ${index}`,
            }),
        });
    }

    const page1 = await request(
        `/rooms/${paginationRoom}/messages?page=1&limit=3`,
        { headers: authHeaders }
    );
    const page2 = await request(
        `/rooms/${paginationRoom}/messages?page=2&limit=3`,
        { headers: authHeaders }
    );

    assert.equal(page1.body.total, 5);
    assert.equal(page1.body.messages.length, 3);
    assert.equal(page2.body.messages.length, 2);

    console.log("[Fase 3] Checklist concluído com sucesso.");
    console.log("[Fase 3] Auth 401, sala inexistente 404, sala vazia, isolamento e paginação OK.");
}

main().catch((error) => {
    console.error("[Fase 3] Checklist falhou:", error.message);
    process.exit(1);
});
