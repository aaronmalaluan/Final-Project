module.exports = (...allowedRoles) => {

    return (req, res, next) => {

        if (!req.session.userId) {
            return res.status(401).json({
                message: 'Authentication required.'
            });
        }

        if (!allowedRoles.includes(req.session.role)) {
            return res.status(403).json({
                message: 'You do not have permission.'
            });
        }

        next();
    };
};