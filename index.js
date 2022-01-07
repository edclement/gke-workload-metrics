/* eslint-disable no-process-exit */
import http from 'http';
import handler from './src/handler.js';

const { PORT = 3000 } = process.env;
const httpServer = http.createServer(handler);
httpServer.listen(PORT, () => console.info(JSON.stringify({ message: `http server started on port ${PORT}` })));

// Purposefully crash and burn on uncaught exceptions
process.on('uncaughtException', (error = {}) => {
  console.error(`uncaught exception: ${error.message}`, error);
  httpServer.close(() => process.exit(1));
});

// Purposefully crash and burn on unhandled promise rejections
process.on('unhandledRejection', (error = {}) => {
  console.error(`unhandled rejection: ${error.message}`, error);
  httpServer.close(() => process.exit(1));
});

// Gracefully terminate when a termination signal is received
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) =>
  process.once(signal, () => {
    console.warn(`signal '${signal}' received, closing http server and exiting`);
    httpServer.close(() => process.exit(0));
  })
);
