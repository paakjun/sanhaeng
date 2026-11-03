// 등산의 목적 — 실시간 멀티플레이 서버
// 게임 페이지(public/)를 제공하고, /ws 웹소켓으로 같은 방(?room=이름) 사람들의 위치를 중계합니다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_PER_ROOM = 40;
const EMOTES = new Set(['', 'wave', 'heart', 'yaho']);
const MOUNTAINS = ['bukhansan', 'seoraksan', 'jirisan', 'hallasan', 'naejangsan', 'gongryong'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

const rooms = new Map(); // 'mountain/room' -> Map(id -> client)
const players = () => [...rooms.values()].reduce((n, r) => n + r.size, 0);

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/api/mountains') {
    const counts = {};
    rooms.forEach((r, key) => { const mt = key.split('/')[0]; counts[mt] = (counts[mt] || 0) + r.size; });
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(counts));
  }
  if (u.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: players() }));
  }
  let p;
  try { p = decodeURIComponent(u.pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('없는 길이에요'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const cleanRoom = (r) => (String(r || 'lobby').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)) || 'lobby';
const num = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const act = (a) => (a && typeof a === 'object' && typeof a.to === 'string' && /^[a-z0-9]{1,24}$/i.test(a.to))
  ? { to: a.to, at: num(a.at, 0, 1e15), ok: a.ok ? 1 : 0 } : undefined;
function sanitize(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    x: num(s.x, -260, 260), z: num(s.z, -260, 260), f: num(s.f, -100, 100), v: num(s.v, 0, 8), el: Math.round(num(s.el, 0, 3000)),
    c: Math.abs(num(s.c, 0, 99) | 0) % 6,
    n: String(s.n || '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯﻿<>]/g, '').trim().slice(0, 10),
    e: EMOTES.has(s.e) ? s.e : '', et: num(s.et, 0, 1e15),
    tr: num(s.tr, 0, 8) | 0,
    mt: MOUNTAINS.includes(s.mt) ? s.mt : '',
    j: ['hiker', 'ranger'].includes(s.j) ? s.j : 'hiker',
    st: act(s.st), wh: act(s.wh), ak: act(s.ak),
    si: s.si ? 1 : 0,
    gb: num(s.gb, 0, 255) | 0,
    cy: num(s.cy, 0, 8), cl: s.cl ? 1 : 0,
  };
}
const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
const broadcast = (room, fromId, m) => { const txt = JSON.stringify(m); room.forEach((c, id) => { if (id !== fromId && c.ws.readyState === 1) c.ws.send(txt); }); };

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://local').searchParams;
  const mt = MOUNTAINS.includes(q.get('mt')) ? q.get('mt') : MOUNTAINS[0];
  const roomName = mt + '/' + cleanRoom(q.get('room'));
  let room = rooms.get(roomName);
  if (!room) { room = new Map(); rooms.set(roomName, room); }
  if (room.size >= MAX_PER_ROOM) { ws.close(1013, 'room full'); return; }

  const id = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
  const me = { ws, s: null, tokens: 20, last: Date.now() };
  room.set(id, me);
  ws.isAlive = true;
  send(ws, { t: 'welcome', id, room: roomName, mt, peers: [...room].filter(([k, c]) => k !== id && c.s).map(([k, c]) => ({ id: k, s: c.s })) });

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (buf) => {
    const now = Date.now();
    me.tokens = Math.min(30, me.tokens + ((now - me.last) / 1000) * 20); me.last = now; // 초당 약 20회까지
    if (me.tokens < 1) return; me.tokens -= 1;
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (!m || m.t !== 'p') return;
    const s = sanitize(m.s); if (!s) return;
    s.mt = mt;
    me.s = s;
    broadcast(room, id, { t: 'p', id, s });
  });
  ws.on('close', () => {
    room.delete(id);
    if (room.size === 0) rooms.delete(roomName); else broadcast(room, id, { t: 'leave', id });
  });
});

// 끊긴 연결 정리
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch {} });
}, 25000);

server.listen(PORT, () => console.log(`등산의 목적 서버가 열렸어요: http://localhost:${PORT}/?room=maru`));
