const crypto = require("crypto");
const userRepository = require("../repositories/user.repository");

class AuthService {
    async register({ name, email, password }) {
        if (!name || !email || !password) {
            throw new Error("Nome, e-mail e senha são obrigatórios.");
        }

        const existingUser = userRepository.getByEmail(email);

        if (existingUser) {
            throw new Error("E-mail já cadastrado.");
        }

        const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
        const user = {
            userId: `user-${Date.now()}`,
            name,
            email,
            passwordHash,
            createdAt: new Date().toISOString(),
        };

        userRepository.create(user);

        return {
            userId: user.userId,
            name: user.name,
            email: user.email,
        };
    }

    async login({ email, password }) {
        if (!email || !password) {
            throw new Error("E-mail e senha são obrigatórios.");
        }

        const user = userRepository.getByEmail(email);

        if (!user) {
            throw new Error("Usuário não encontrado.");
        }

        const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

        if (user.passwordHash !== passwordHash) {
            throw new Error("Senha incorreta.");
        }

        const token = crypto.randomBytes(16).toString("hex");

        return {
            token,
            user: {
                userId: user.userId,
                name: user.name,
                email: user.email,
            },
        };
    }
}

module.exports = new AuthService();
