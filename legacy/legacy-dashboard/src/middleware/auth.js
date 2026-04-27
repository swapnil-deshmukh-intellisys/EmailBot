function authenticateToken(req, res, next) {
  // Demo auth mode
  req.user = { userId: 'demo-user', role: 'Admin' };
  next();
}

module.exports = { authenticateToken };
