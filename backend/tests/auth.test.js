const test = require("node:test");
const assert = require("node:assert/strict");

const authService = require("../services/auth.service");

test("deve cadastrar um usuário novo e permitir login", async () => {
    const email = `user-${Date.now()}@example.com`;

    const registered = await authService.register({
        name: "Teste",
        email,
        password: "Senha123!",
    });

    assert.equal(registered.email, email);
    assert.ok(registered.userId);

    const loggedIn = await authService.login({
        email,
        password: "Senha123!",
    });

    assert.equal(loggedIn.user.email, email);
    assert.ok(loggedIn.token);
});

test("deve rejeitar senha incorreta", async () => {
    const email = `user-${Date.now() + 1}@example.com`;

    await authService.register({
        name: "Teste",
        email,
        password: "Senha123!",
    });

    await assert.rejects(
        () => authService.login({
            email,
            password: "senha-errada",
        }),
        /senha/i
    );
});
