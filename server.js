/**
 * Lightweight local web server for the BNE flights app.
 *
 * Routes:
 *   GET /            -> static index.html
 *   GET /style.css    -> static stylesheet
 *   GET /app.js       -> static frontend script
 *   GET /api/flights  -> JSON { incoming, outgoing, overflights, fetchedAt }
 *
 * No dependencies beyond Node's built-in http/fs modules.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getBneFlights } = require('./api');

const PORT = process.env.PORT || 3939;
const PUBLIC_DIR = path.join(__dirname, 'public');

const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html' },
  '/style.css': { file: 'style.css', type: 'text/css' },
  '/app.js': { file: 'app.js', type: 'application/javascript' },
};

async function handleFlightsRequest(res) {
  try {
    const data = await getBneFlights(50);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...data, fetchedAt: new Date().toISOString() }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function serveStatic(res, staticEntry) {
  const filePath = path.join(PUBLIC_DIR, staticEntry.file);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Failed to load file');
      return;
    }
    res.writeHead(200, { 'Content-Type': staticEntry.type });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/flights') {
    handleFlightsRequest(res);
    return;
  }

  const staticEntry = STATIC_FILES[url.pathname];
  if (staticEntry) {
    serveStatic(res, staticEntry);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`BNE flights app running at http://localhost:${PORT}`);
});
