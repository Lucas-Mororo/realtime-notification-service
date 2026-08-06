const express = require("express");
const authService = require("../services/auth.service");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/auth/register", async (req, res) => {
    try {
        const result = await authService.register(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

router.post("/auth/login", async (req, res) => {
    try {
        const result = await authService.login(req.body);
        req.app.locals.sessions[result.token] = result.user;
        return res.json(result);
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }
});

router.get("/auth/me", authenticate, (req, res) => {
    return res.json({ user: req.user });
});

module.exports = router;
