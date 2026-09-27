/**
 * Sign Bridge - Local Web Server
 * Serves the speech-to-text assistive app with zero external dependencies.
 * Automatically listens on port 8080 and 3000.
 * Automatically discovers local Wi-Fi IP so user can open it on their mobile phone!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PRIMARY_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const SECONDARY_PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=UTF-8'
};

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Find IPv4 non-internal address (Wi-Fi or Ethernet)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function handleRequest(req, res) {
  let safePath = req.url.split('?')[0];
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  // Prevent directory traversal
  const safeNormalized = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safeNormalized);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    }
  });
}

function startServer(port, isPrimary = false) {
  const server = http.createServer(handleRequest);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Sign Bridge] Port ${port} is already in use.`);
    } else {
      console.error(`[Sign Bridge] Server error on port ${port}:`, err.message);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    if (isPrimary) {
      console.log(`=======================================================`);
      console.log(`Sign Bridge - Real-Time Voice Captioning for Deaf Users`);
      console.log(`Computer Browser:  \x1b[32mhttp://localhost:${port}\x1b[0m`);
      console.log(`Phone Browser (Wi-Fi): \x1b[36mhttp://${localIp}:${port}\x1b[0m`);
      console.log(`=======================================================`);
    } else {
      console.log(`[Sign Bridge] Secondary port: http://localhost:${port}`);
    }
  });

  return server;
}

// Start primary server on port 8080
startServer(PRIMARY_PORT, true);

// Also start secondary server on port 3000 if different
if (PRIMARY_PORT !== SECONDARY_PORT) {
  startServer(SECONDARY_PORT, false);
}
