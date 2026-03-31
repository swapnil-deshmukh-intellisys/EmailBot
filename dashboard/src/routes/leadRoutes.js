const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { authenticateToken } = require('../middleware/auth');
const { UPLOADS_DIR, DATA_DIR, ROOT_DIR } = require('../config/paths');

const router = express.Router();
const upload = multer({ dest: UPLOADS_DIR });

router.get('/', authenticateToken, (req, res) => {
  const pythonCmd = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(ROOT_DIR, 'daily_campaign.py');

  const child = spawn(pythonCmd, [scriptPath, '--dump'], { shell: false });
  let stdout = '';
  let stderr = '';
  let spawnError = null;

  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (err) => { spawnError = err; });

  child.on('close', (code) => {
    if (stderr) console.error('leads dump stderr:', stderr);
    if (spawnError || code !== 0) {
      return res.status(200).json({
        success: false,
        leads: [],
        error: spawnError ? spawnError.message : (stderr || `daily_campaign exited with code ${code}`)
      });
    }

    try {
      const leads = JSON.parse(stdout);
      res.json({ success: code === 0, leads });
    } catch (e) {
      res.status(200).json({
        success: false,
        leads: [],
        error: 'Failed to parse leads output',
        raw: stdout,
        code
      });
    }
  });
});

router.post('/upload-leads', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const dest = path.resolve(DATA_DIR, 'clients_new.xlsx');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.rename(req.file.path, dest, (err) => {
    if (err) {
      if (err.code === 'EXDEV') {
        fs.copyFile(req.file.path, dest, (copyErr) => {
          if (copyErr) {
            console.error('upload copy error', copyErr);
            return res.status(500).json({ error: 'Failed to save file' });
          }
          fs.unlink(req.file.path, () => {
            res.json({ success: true, message: 'Leads file uploaded', path: dest });
          });
        });
        return;
      }
      console.error('upload error', err);
      return res.status(500).json({ error: 'Failed to save file' });
    }
    res.json({ success: true, message: 'Leads file uploaded', path: dest });
  });
});

module.exports = router;
