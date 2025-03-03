require('dotenv').config();
const app = require('./src/index');
const http = require('http');

const PORT = 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Try accessing: http://localhost:${PORT}/dashboard`);
  console.log('Press Ctrl+C to stop the server');
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down test server');
  server.close();
  process.exit(0);
}); 