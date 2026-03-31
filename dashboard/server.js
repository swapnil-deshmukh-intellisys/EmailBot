require('dotenv').config();

const { createApp, initDependencies } = require('./src/app');

const PORT = Number(process.env.PORT) || 5000;
const app = createApp();

let server = null;
let activePort = PORT;

const startServer = () => {
  server = app.listen(activePort, () => {
    console.log(`Server running on port ${activePort}`);
    console.log(`Dashboard: http://localhost:${activePort}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${activePort} is in use. Retrying on ${activePort + 1}...`);
      activePort += 1;
      setTimeout(startServer, 200);
      return;
    }
    console.error('Server startup error:', err);
    process.exit(1);
  });
};

initDependencies()
  .then(startServer)
  .catch((err) => {
    console.error('Initialization error:', err);
    process.exit(1);
  });

const shutdown = () => {
  console.log('Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
