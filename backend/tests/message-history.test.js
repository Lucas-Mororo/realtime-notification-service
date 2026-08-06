const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const testStoragePath = path.join(
    os.tmpdir(),
    `messages-test-${process.pid}.json`
);

process.env.MESSAGES_STORAGE_PATH = testStoragePath;

delete require.cache[
    require.resolve("../repositories/message-history.repository")
];
delete require.cache[
    require.resolve("../services/message-history.service")
];

const messageHistoryService =
    require("../services/message-history.service");

test.beforeEach(() => {
    fs.writeFileSync(
        testStoragePath,
        JSON.stringify({ messages: [] }, null, 2)
    );
});

test.after(() => {
    if (fs.existsSync(testStoragePath)) {
        fs.unlinkSync(testStoragePath);
    }
});

function buildNotification(roomId, message) {
    return {
        type: "message",
        roomId,
        userId: "user-test",
        message,
        timestamp: new Date().toISOString(),
    };
}

test("getByRoom retorna total 0 e messages vazio para sala sem mensagens", () => {
    const result = messageHistoryService.getByRoom(
        "room-empty"
    );

    assert.equal(result.total, 0);
    assert.deepEqual(result.messages, []);
});

test("save incrementa total da sala", () => {
    messageHistoryService.save(
        buildNotification("room-a", "mensagem 1")
    );

    const result = messageHistoryService.getByRoom("room-a");

    assert.equal(result.total, 1);
    assert.equal(result.messages[0].message, "mensagem 1");
});

test("mensagens de room-a não aparecem em room-b", () => {
    messageHistoryService.save(
        buildNotification("room-a", "mensagem A")
    );
    messageHistoryService.save(
        buildNotification("room-b", "mensagem B")
    );

    const roomA = messageHistoryService.getByRoom("room-a");
    const roomB = messageHistoryService.getByRoom("room-b");

    assert.equal(roomA.total, 1);
    assert.equal(roomB.total, 1);
    assert.equal(roomA.messages[0].roomId, "room-a");
    assert.equal(roomB.messages[0].roomId, "room-b");
});

test("paginação retorna subset correto", () => {
    for (let index = 1; index <= 5; index += 1) {
        messageHistoryService.save(
            buildNotification(
                "room-pagination",
                `mensagem ${index}`
            )
        );
    }

    const page1 = messageHistoryService.getByRoom(
        "room-pagination",
        { page: 1, limit: 2 }
    );
    const page2 = messageHistoryService.getByRoom(
        "room-pagination",
        { page: 2, limit: 2 }
    );
    const page3 = messageHistoryService.getByRoom(
        "room-pagination",
        { page: 3, limit: 2 }
    );

    assert.equal(page1.total, 5);
    assert.equal(page1.messages.length, 2);
    assert.equal(page1.messages[0].message, "mensagem 1");
    assert.equal(page1.messages[1].message, "mensagem 2");

    assert.equal(page2.messages.length, 2);
    assert.equal(page2.messages[0].message, "mensagem 3");
    assert.equal(page2.messages[1].message, "mensagem 4");

    assert.equal(page3.messages.length, 1);
    assert.equal(page3.messages[0].message, "mensagem 5");
});
