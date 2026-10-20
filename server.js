// Local server for editing the list: serves the site and lets admin.html
// write data/levels.json. Zero dependencies. Run with `npm start`.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'levels.json');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function saveLevels(req, res) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 5_000_000) req.destroy();
  });
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return send(res, 400, 'JSON inválido');
    }
    if (!parsed || !Array.isArray(parsed.levels)) return send(res, 400, 'Falta el array "levels"');
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(parsed, null, 2) + '\n', (err) => {
      if (err) return send(res, 500, err.message);
      fs.rename(tmp, DATA_FILE, (err2) => {
        if (err2) return send(res, 500, err2.message);
        console.log(`[${new Date().toLocaleTimeString()}] levels.json guardado (${parsed.levels.length} niveles)`);
        send(res, 200, 'ok');
      });
    });
  });
}

// Level backgrounds go to common/niveles/<name>.<ext>; responds with the relative path.
const UPLOAD_DIR = path.join(ROOT, 'common', 'niveles');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function saveImage(req, res, url) {
  const ext = path.extname(url.searchParams.get('name') || '').toLowerCase();
  const base = path.basename(url.searchParams.get('name') || '', ext).replace(/[^a-z0-9-]/gi, '').slice(0, 60);
  if (!base || !IMAGE_EXTS.has(ext)) return send(res, 400, 'Nombre o formato de imagen inválido');
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 10_000_000) return req.destroy();
    chunks.push(chunk);
  });
  req.on('end', () => {
    fs.mkdir(UPLOAD_DIR, { recursive: true }, (err) => {
      if (err) return send(res, 500, err.message);
      const name = `${base}${ext}`;
      fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.concat(chunks), (err2) => {
        if (err2) return send(res, 500, err2.message);
        console.log(`[${new Date().toLocaleTimeString()}] imagen guardada: common/niveles/${name}`);
        send(res, 200, JSON.stringify({ path: `common/niveles/${name}` }), TYPES['.json']);
      });
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/ping') return send(res, 200, '{"ok":true}', TYPES['.json']);
  if (url.pathname === '/api/levels') {
    if (req.method === 'PUT') return saveLevels(req, res);
    return send(res, 405, 'Usá PUT');
  }
  if (url.pathname === '/api/upload') {
    if (req.method === 'PUT') return saveImage(req, res, url);
    return send(res, 405, 'Usá PUT');
  }

  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, 'Prohibido');
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (path.relative(ROOT, file).split(path.sep)[0].startsWith('.')) return send(res, 404, 'No encontrado');

  fs.readFile(file, (err, content) => {
    if (err) return send(res, 404, 'No encontrado');
    send(res, 200, content, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Porotos List corriendo:`);
  console.log(`  Lista:  http://localhost:${PORT}/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin.html`);
});
