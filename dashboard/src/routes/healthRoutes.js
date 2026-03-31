const express = require('express');
const { getDbHealth } = require('../config/database');

const router = express.Router();

router.get('/db', (req, res) => {
  res.json(getDbHealth());
});

module.exports = router;
