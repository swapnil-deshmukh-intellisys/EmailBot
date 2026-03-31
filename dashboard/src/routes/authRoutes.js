const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username } = req.body;

  const token = jwt.sign(
    { userId: 'demo-user', role: 'Admin' },
    process.env.JWT_SECRET || 'demo-secret',
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { username: username || 'Admin', role: 'Admin' }
  });
});

module.exports = router;
