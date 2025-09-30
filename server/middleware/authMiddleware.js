const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    // 1. Get the token from the request header
    // We'll look for it in a header named 'x-auth-token'
    const token = req.header('x-auth-token');

    // 2. Check if no token is provided
    if (!token) {
        // 401 Unauthorized is the appropriate status code
        return res.status(401).json({ msg: 'No token, authorization denied.' });
    }

    try {
        // 3. Verify the token
        // This checks if the token is valid and hasn't expired
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Attach the user's info to the request object
        // The decoded payload contains the user's id and role that we put in it during login
        req.user = decoded;

        // 5. Call next() to proceed to the actual route
        next();
    } catch (e) {
        // This will run if the token is invalid (e.g., tampered with or expired)
        res.status(401).json({ msg: 'Token is not valid.' });
    }
}

module.exports = authMiddleware;