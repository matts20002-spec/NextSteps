// Custom-built auth middleware (no Cognito, no auth library beyond
// jsonwebtoken + bcrypt). The client sends the JWT it got at login back on
// every request as `Authorization: Bearer <token>`.
const jwt = require('jsonwebtoken');

// Verifies the JWT and attaches the decoded payload ({ id, username, isAdmin })
// to req.user. Rejects the request with 401 if the token is missing/invalid.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Use after requireAuth to additionally restrict a route to the admin account.
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
