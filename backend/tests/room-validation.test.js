const test = require("node:test");
const assert = require("node:assert/strict");

const notificationController = require("../controllers/notification.controller");
const roomController = require("../controllers/room.controller");

function createMockResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

test("POST /notify retorna 404 quando a sala não existe", async () => {
    const req = {
        body: {
            userId: "user-1",
            roomId: "room-does-not-exist",
            message: "Olá",
        },
    };

    const res = createMockResponse();

    await notificationController.publishNotification(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /Sala não encontrada/i);
});

test("GET /rooms/:roomId/messages retorna 404 quando a sala não existe", () => {
    const req = {
        params: { roomId: "room-does-not-exist" },
        query: { page: "1", limit: "10" },
    };

    const res = createMockResponse();

    roomController.getRoomMessages(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /Sala não encontrada/i);
});
