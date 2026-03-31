const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DASHBOARD_DIR = path.resolve(ROOT_DIR, 'dashboard');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const PUBLIC_DIR = path.resolve(DASHBOARD_DIR, 'public');
const UPLOADS_DIR = path.resolve(DASHBOARD_DIR, 'uploads');

module.exports = {
  ROOT_DIR,
  DASHBOARD_DIR,
  DATA_DIR,
  PUBLIC_DIR,
  UPLOADS_DIR
};
