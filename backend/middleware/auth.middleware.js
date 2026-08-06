function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const sessions = req.app.locals?.sessions || {};

    if (!token || !sessions[token]) {
        return res.status(401).json({ error: "Não autenticado." });
    }

    req.user = sessions[token];
    next();
}

module.exports = {
    authenticate,
};
