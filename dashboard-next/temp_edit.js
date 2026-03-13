
const fs = require('fs');
const path = require('path');
const filePath = path.join(process.cwd(), 'app', 'dashboard', 'page.js');
let content = fs.readFileSync(filePath, 'utf8');
