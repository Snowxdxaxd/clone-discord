// «Эхо» — клон Discord для портфолио.
// Серверы (гильдии), текстовые каналы, ЛС, presence, typing, голосовые комнаты (WebRTC mesh).
import { createApp, json, badRequest, unauthorized, notFound, parseCookies } from './lib/http.mjs';
import { migrate, db, uid } from './lib/db.mjs';
import { ensureAuthTables, loginByName, currentUser, logout } from './lib/auth.mjs';
import { setupWs, sendTo } from './lib/ws.mjs';
import { now, clamp } from './lib/util.mjs';

migrate([
  {
    id: '001-init',
    sql: `
      create table users (
        id text primary key,
        name text not null,
        created integer not null
      );
      create table servers (
        id text primary key,
        name text not null,
        owner_id text not null references users(id),
        invite_code text not null unique,
        created integer not null
      );
      create table channels (
        id text primary key,
        server_id text not null references servers(id) on delete cascade,
        name text not null,
        kind text not null check (kind in ('text','voice')),
        position integer not null default 0,
        created integer not null
      );
      create table memberships (
        user_id text not null references users(id),
        server_id text not null references servers(id) on delete cascade,
        role text not null default 'member' check (role in ('owner','member')),
        created integer not null,
        primary key (user_id, server_id)
      );
      create table messages (
        id text primary key,
        channel_id text not null references channels(id) on delete cascade,
        user_id text not null references users(id),
        text text not null,
        created integer not null,
        edited_at integer
      );
      create table dm_messages (
        id text primary key,
        from_id text not null references users(id),
        to_id text not null references users(id),
        text text not null,
        created integer not null
      );
      create index if not exists idx_messages_channel on messages(channel_id, created);
      create index if not exists idx_dm_from on dm_messages(from_id, created);
      create index if not exists idx_dm_to on dm_messages(to_id, created);
    `,
  },
]);
ensureAuthTables(db);

// ---------- Seed при пустой БД ----------
if (!db.prepare('select 1 from servers limit 1').get()) {
  db.transaction(() => {
    const su = uid('u_');
    db.prepare('insert into users(id, name, created) values (?, ?, ?)').run(su, 'Гость', now());
    const sid = uid('sv_');
    db.prepare('insert into servers(id, name, owner_id, invite_code, created) values (?, ?, ?, ?, ?)')
      .run(sid, 'Основной', su, 'DEMO', now());
    db.prepare('insert into memberships(user_id, server_id, role, created) values (?, ?, ?, ?)')
      .run(su, sid, 'owner', now());
    const insCh = db.prepare('insert into channels(id, server_id, name, kind, position, created) values (?, ?, ?, ?, ?, ?)');
    const cCommon = uid('ch_'), cMemes = uid('ch_'), cV1 = uid('ch_'), cV2 = uid('ch_');
    insCh.run(cCommon, sid, 'общий', 'text', 0, now());
    insCh.run(cMemes, sid, 'мемы', 'text', 1, now());
    insCh.run(cV1, sid, 'Комната 1', 'voice', 2, now());
    insCh.run(cV2, sid, 'Комната 2', 'voice', 3, now());
    const insMsg = db.prepare('insert into messages(id, channel_id, user_id, text, created) values (?, ?, ?, ?, ?)');
    insMsg.run(uid('m_'), cCommon, su, 'Привет! Это «Эхо»: текстовые каналы, личные сообщения и голосовые комнаты.', now() - 120000);
    insMsg.run(uid('m_'), cCommon, su, 'Код приглашения этого сервера: DEMO. Передай его другу — он сможет присоединиться.', now() - 60000);
  })();
}

// ---------- Состояние в памяти ----------
const online = new Map();      // userId -> Set<ws>
const typing = new Map();      // channelId -> Map<userName, until>
const voiceRooms = new Map();  // channelId (voice) -> Map<userId, {userName, joinedAt}>

// ---------- Помощники ----------
const userById = (id) => db.prepare('select id, name, created from users where id = ?').get(id);
const memberIdsOf = (serverId) =>
  db.prepare('select user_id from memberships where server_id = ?').all(serverId).map((r) => r.user_id);
const isMember = (userId, serverId) =>
  !!db.prepare('select 1 from memberships where user_id = ? and server_id = ?').get(userId, serverId);

function sendToUser(userId, type, data) {
  const set = online.get(userId);
  if (!set) return;
  for (const ws of set) sendTo(ws, type, data);
}

function toMembers(serverId, type, data, exceptUserId = null) {
  for (const id of memberIdsOf(serverId)) {
    if (id !== exceptUserId) sendToUser(id, type, data);
  }
}

function occupancyOf(channelId) {
  const room = voiceRooms.get(channelId);
  return room ? [...room.entries()].map(([userId, v]) => ({ userId, userName: v.userName })) : [];
}

function presenceFor(userId) {
  const ids = new Set();
  for (const r of db.prepare('select server_id from memberships where user_id = ?').all(userId)) {
    for (const m of memberIdsOf(r.server_id)) if (online.has(m)) ids.add(m);
  }
  const peers = db.prepare(
    `select from_id as u from dm_messages where to_id = ?
     union
     select to_id as u from dm_messages where from_id = ?`
  ).all(userId, userId);
  for (const p of peers) if (online.has(p.u)) ids.add(p.u);
  if (online.has(userId)) ids.add(userId);
  return [...ids];
}

function pushPresenceAll() {
  for (const userId of online.keys()) {
    const set = online.get(userId);
    if (set) for (const ws of set) sendTo(ws, 'presence', { online: presenceFor(userId) });
  }
}

function requireUser(ctx) {
  const user = currentUser(db, ctx);
  if (!user) unauthorized(ctx.res);
  return user;
}

function genInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const getMsg = (id) =>
  db.prepare(
    `select m.*, u.name as user_name from messages m join users u on u.id = m.user_id where m.id = ?`
  ).get(id);

function cleanText(raw) {
  return String(raw ?? '').replace(/\r\n/g, '\n').trim();
}

// ---------- REST: авторизация ----------
const app = createApp({ publicDir: 'public', spa: true });

app.post('/api/login', (ctx) => {
  const user = loginByName(db, ctx.res, ctx.body?.name);
  if (!user) return badRequest(ctx.res, 'need_name');
  json(ctx.res, 200, { user });
});

app.post('/api/logout', (ctx) => {
  logout(db, ctx);
  json(ctx.res, 200, { ok: true });
});

app.get('/api/me', (ctx) => {
  json(ctx.res, 200, { user: currentUser(db, ctx) });
});

// ---------- REST: серверы ----------
app.post('/api/servers', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const name = String(ctx.body?.name ?? '').trim().slice(0, 64);
  if (!name) return badRequest(ctx.res, 'need_name');
  const sid = uid('sv_');
  const server = { id: sid, name, owner_id: user.id, invite_code: genInviteCode(), created: now() };
  db.transaction(() => {
    db.prepare('insert into servers(id, name, owner_id, invite_code, created) values (?, ?, ?, ?, ?)')
      .run(sid, name, user.id, server.invite_code, server.created);
    db.prepare('insert into memberships(user_id, server_id, role, created) values (?, ?, ?, ?)')
      .run(user.id, sid, 'owner', now());
    const insCh = db.prepare('insert into channels(id, server_id, name, kind, position, created) values (?, ?, ?, ?, ?, ?)');
    insCh.run(uid('ch_'), sid, 'общий', 'text', 0, now());
    insCh.run(uid('ch_'), sid, 'Голосовая', 'voice', 1, now());
  })();
  pushPresenceAll();
  json(ctx.res, 200, { server });
});

app.post('/api/servers/join', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const code = String(ctx.body?.code ?? '').trim();
  if (!code) return badRequest(ctx.res, 'need_code');
  const server = db.prepare('select * from servers where lower(invite_code) = lower(?)').get(code);
  if (!server) return json(ctx.res, 404, { error: 'server_not_found' });
  if (!isMember(user.id, server.id)) {
    db.prepare('insert into memberships(user_id, server_id, role, created) values (?, ?, ?, ?)')
      .run(user.id, server.id, 'member', now());
    pushPresenceAll();
  }
  json(ctx.res, 200, { server });
});

app.get('/api/servers', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const servers = db.prepare(
    `select s.* from servers s join memberships m on m.server_id = s.id
     where m.user_id = ? order by s.created`
  ).all(user.id);
  json(ctx.res, 200, { servers });
});

app.get('/api/servers/:id', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const server = db.prepare('select * from servers where id = ?').get(ctx.params.id);
  if (!server) return notFound(ctx.res);
  if (!isMember(user.id, server.id)) return json(ctx.res, 403, { error: 'forbidden' });
  const channels = db.prepare('select * from channels where server_id = ? order by position, created').all(server.id)
    .map((ch) => (ch.kind === 'voice' ? { ...ch, occupancy: occupancyOf(ch.id) } : ch));
  const members = db.prepare(
    `select u.id, u.name, m.role from memberships m join users u on u.id = m.user_id
     where m.server_id = ? order by u.created`
  ).all(server.id).map((m) => ({ ...m, online: online.has(m.id) }));
  json(ctx.res, 200, { server, channels, members });
});

// ---------- REST: каналы ----------
app.post('/api/servers/:id/channels', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const server = db.prepare('select * from servers where id = ?').get(ctx.params.id);
  if (!server) return notFound(ctx.res);
  if (!isMember(user.id, server.id)) return json(ctx.res, 403, { error: 'forbidden' });
  const name = String(ctx.body?.name ?? '').trim().slice(0, 32);
  const kind = ctx.body?.kind;
  if (!name) return badRequest(ctx.res, 'need_name');
  if (kind !== 'text' && kind !== 'voice') return badRequest(ctx.res, 'bad_kind');
  const pos = db.prepare('select coalesce(max(position), -1) + 1 as p from channels where server_id = ?').get(server.id).p;
  const cid = uid('ch_');
  db.prepare('insert into channels(id, server_id, name, kind, position, created) values (?, ?, ?, ?, ?, ?)')
    .run(cid, server.id, name, kind, pos, now());
  const channel = db.prepare('select * from channels where id = ?').get(cid);
  toMembers(server.id, 'channel:new', { serverId: server.id, channel });
  json(ctx.res, 200, { channel });
});

app.delete('/api/channels/:id', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const channel = db.prepare('select * from channels where id = ?').get(ctx.params.id);
  if (!channel) return notFound(ctx.res);
  const server = db.prepare('select * from servers where id = ?').get(channel.server_id);
  if (!server || server.owner_id !== user.id) return json(ctx.res, 403, { error: 'forbidden' });
  db.prepare('delete from channels where id = ?').run(channel.id);
  toMembers(server.id, 'channel:delete', { serverId: server.id, channelId: channel.id });
  json(ctx.res, 200, { ok: true });
});

// ---------- REST: сообщения ----------
app.get('/api/channels/:id/messages', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const channel = db.prepare('select * from channels where id = ?').get(ctx.params.id);
  if (!channel) return notFound(ctx.res);
  if (!isMember(user.id, channel.server_id)) return json(ctx.res, 403, { error: 'forbidden' });
  if (channel.kind !== 'text') return badRequest(ctx.res, 'not_text_channel');
  const limit = clamp(parseInt(ctx.query.get('limit') || '50', 10) || 50, 1, 100);
  const before = parseInt(ctx.query.get('before') || '', 10);
  const rows = Number.isFinite(before)
    ? db.prepare(
        `select m.*, u.name as user_name from messages m join users u on u.id = m.user_id
         where m.channel_id = ? and m.created < ? order by m.created desc limit ?`
      ).all(channel.id, before, limit)
    : db.prepare(
        `select m.*, u.name as user_name from messages m join users u on u.id = m.user_id
         where m.channel_id = ? order by m.created desc limit ?`
      ).all(channel.id, limit);
  let hasMore = false;
  if (rows.length === limit) {
    const oldest = rows[rows.length - 1].created;
    hasMore = !!db.prepare('select 1 from messages where channel_id = ? and created < ? limit 1').get(channel.id, oldest);
  }
  rows.reverse();
  json(ctx.res, 200, { messages: rows, hasMore });
});

app.post('/api/channels/:id/messages', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const channel = db.prepare('select * from channels where id = ?').get(ctx.params.id);
  if (!channel) return notFound(ctx.res);
  if (!isMember(user.id, channel.server_id)) return json(ctx.res, 403, { error: 'forbidden' });
  if (channel.kind !== 'text') return badRequest(ctx.res, 'not_text_channel');
  const text = cleanText(ctx.body?.text);
  if (!text) return badRequest(ctx.res, 'empty_message');
  if (text.length > 2000) return badRequest(ctx.res, 'too_long');
  const id = uid('m_');
  db.prepare('insert into messages(id, channel_id, user_id, text, created) values (?, ?, ?, ?, ?)')
    .run(id, channel.id, user.id, text, now());
  const message = getMsg(id);
  toMembers(channel.server_id, 'message:new', { message, serverId: channel.server_id, channelId: channel.id });
  json(ctx.res, 200, { message });
});

function findMessageContext(id) {
  const message = getMsg(id);
  if (!message) return {};
  const channel = db.prepare('select * from channels where id = ?').get(message.channel_id);
  return { message, channel };
}

app.patch('/api/messages/:id', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const { message, channel } = findMessageContext(ctx.params.id);
  if (!message) return notFound(ctx.res);
  if (message.user_id !== user.id) return json(ctx.res, 403, { error: 'forbidden' });
  const text = cleanText(ctx.body?.text);
  if (!text) return badRequest(ctx.res, 'empty_message');
  if (text.length > 2000) return badRequest(ctx.res, 'too_long');
  db.prepare('update messages set text = ?, edited_at = ? where id = ?').run(text, now(), message.id);
  const fresh = getMsg(message.id);
  toMembers(channel.server_id, 'message:edit', { message: fresh, serverId: channel.server_id, channelId: channel.id });
  json(ctx.res, 200, { message: fresh });
});

app.delete('/api/messages/:id', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const { message, channel } = findMessageContext(ctx.params.id);
  if (!message) return notFound(ctx.res);
  if (message.user_id !== user.id) return json(ctx.res, 403, { error: 'forbidden' });
  db.prepare('delete from messages where id = ?').run(message.id);
  toMembers(channel.server_id, 'message:delete', {
    serverId: channel.server_id, channelId: channel.id, id: message.id,
  });
  json(ctx.res, 200, { ok: true });
});

// ---------- REST: typing ----------
app.post('/api/channels/:id/typing', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const channel = db.prepare('select * from channels where id = ?').get(ctx.params.id);
  if (!channel) return notFound(ctx.res);
  if (!isMember(user.id, channel.server_id)) return json(ctx.res, 403, { error: 'forbidden' });
  if (channel.kind !== 'text') return badRequest(ctx.res, 'not_text_channel');
  const map = typing.get(channel.id) || new Map();
  const t = now();
  for (const [n, until] of map) if (until < t) map.delete(n);
  map.set(user.name, t + 4000);
  typing.set(channel.id, map);
  toMembers(channel.server_id, 'typing', {
    channelId: channel.id, userName: user.name, until: t + 4000,
  }, user.id);
  json(ctx.res, 200, { ok: true });
});

// ---------- REST: личные сообщения ----------
app.get('/api/dm', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const rows = db.prepare(
    `select * from dm_messages where from_id = ? or to_id = ? order by created desc limit 300`
  ).all(user.id, user.id);
  const byPeer = new Map();
  for (const r of rows) {
    const peerId = r.from_id === user.id ? r.to_id : r.from_id;
    if (!byPeer.has(peerId)) byPeer.set(peerId, r);
  }
  const dialogs = [...byPeer.entries()].map(([peerId, r]) => {
    const u = userById(peerId);
    return {
      userId: peerId,
      name: u ? u.name : 'Неизвестный',
      lastText: r.text,
      lastAt: r.created,
      online: online.has(peerId),
    };
  }).sort((a, b) => b.lastAt - a.lastAt);
  json(ctx.res, 200, { dialogs });
});

app.get('/api/dm/:userId/messages', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const peer = userById(ctx.params.userId);
  if (!peer) return notFound(ctx.res);
  const limit = clamp(parseInt(ctx.query.get('limit') || '50', 10) || 50, 1, 200);
  const before = parseInt(ctx.query.get('before') || '', 10);
  const rows = Number.isFinite(before)
    ? db.prepare(
        `select d.*, u.name as from_name from dm_messages d join users u on u.id = d.from_id
         where ((d.from_id = ? and d.to_id = ?) or (d.from_id = ? and d.to_id = ?)) and d.created < ?
         order by d.created desc limit ?`
      ).all(user.id, peer.id, peer.id, user.id, before, limit)
    : db.prepare(
        `select d.*, u.name as from_name from dm_messages d join users u on u.id = d.from_id
         where (d.from_id = ? and d.to_id = ?) or (d.from_id = ? and d.to_id = ?)
         order by d.created desc limit ?`
      ).all(user.id, peer.id, peer.id, user.id, limit);
  let hasMore = false;
  if (rows.length === limit) {
    const oldest = rows[rows.length - 1].created;
    hasMore = !!db.prepare(
      `select 1 from dm_messages where created < ? and
       ((from_id = ? and to_id = ?) or (from_id = ? and to_id = ?)) limit 1`
    ).get(oldest, user.id, peer.id, peer.id, user.id);
  }
  rows.reverse();
  json(ctx.res, 200, { messages: rows, hasMore, peer: { id: peer.id, name: peer.name, online: online.has(peer.id) } });
});

app.post('/api/dm/:userId', (ctx) => {
  const user = requireUser(ctx); if (!user) return;
  const peer = userById(ctx.params.userId);
  if (!peer) return notFound(ctx.res);
  if (peer.id === user.id) return badRequest(ctx.res, 'no_self_dm');
  const text = cleanText(ctx.body?.text);
  if (!text) return badRequest(ctx.res, 'empty_message');
  if (text.length > 2000) return badRequest(ctx.res, 'too_long');
  const id = uid('dm_');
  db.prepare('insert into dm_messages(id, from_id, to_id, text, created) values (?, ?, ?, ?, ?)')
    .run(id, user.id, peer.id, text, now());
  const message = db.prepare(
    `select d.*, u.name as from_name from dm_messages d join users u on u.id = d.from_id where d.id = ?`
  ).get(id);
  sendToUser(user.id, 'dm:new', { message, peerId: peer.id });
  sendToUser(peer.id, 'dm:new', { message, peerId: user.id });
  json(ctx.res, 200, { message });
});

// ---------- WebSocket ----------
function leaveVoice(userId) {
  for (const [channelId, room] of voiceRooms) {
    const v = room.get(userId);
    if (!v) continue;
    room.delete(userId);
    if (!room.size) voiceRooms.delete(channelId);
    const channel = db.prepare('select server_id from channels where id = ?').get(channelId);
    if (channel) {
      toMembers(channel.server_id, 'voice:leave', {
        channelId, userId, userName: v.userName, occupants: occupancyOf(channelId),
      });
    }
  }
}

function handleWsMsg(ws, userId, user, msg) {
  switch (msg.type) {
    case 'heartbeat': {
      sendTo(ws, 'heartbeat', { t: now() });
      break;
    }
    case 'voice:join': {
      const channel = msg.channelId ? db.prepare('select * from channels where id = ?').get(msg.channelId) : null;
      if (!channel || channel.kind !== 'voice') return sendTo(ws, 'voice:error', { error: 'no_channel' });
      if (!isMember(userId, channel.server_id)) return sendTo(ws, 'voice:error', { error: 'forbidden' });
      leaveVoice(userId);
      const room = voiceRooms.get(channel.id) || new Map();
      voiceRooms.set(channel.id, room);
      room.set(userId, { userName: user.name, joinedAt: now() });
      toMembers(channel.server_id, 'voice:join', {
        channelId: channel.id, userId, userName: user.name, occupants: occupancyOf(channel.id),
      });
      break;
    }
    case 'voice:leave': {
      leaveVoice(userId);
      break;
    }
    case 'voice:signal': {
      const to = typeof msg.to === 'string' ? msg.to : '';
      if (!to || msg.data == null) return;
      sendToUser(to, 'voice:signal', { from: userId, data: msg.data });
      break;
    }
    default:
      break;
  }
}

function onConn(ws, url, req) {
  const cookies = parseCookies(req);
  const session = cookies.sid
    ? db.prepare('select user_id from sessions where token = ?').get(cookies.sid)
    : null;
  const user = session ? userById(session.user_id) : null;
  if (!user) {
    ws.close(4001, 'unauthorized');
    return;
  }
  const userId = user.id;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let set = online.get(userId);
  if (!set) {
    set = new Set();
    online.set(userId, set);
  }
  set.add(ws);
  pushPresenceAll();
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    try { handleWsMsg(ws, userId, user, msg); } catch (e) { console.error('ws handler:', e); }
  });
  ws.on('close', () => {
    const cur = online.get(userId);
    if (cur) {
      cur.delete(ws);
      if (!cur.size) {
        online.delete(userId);
        leaveVoice(userId);
      }
    }
    pushPresenceAll();
  });
  ws.on('error', () => { try { ws.close(); } catch {} });
}

const PORT = process.env.PORT || 3011;
app.listen(PORT, (server) => {
  const wss = setupWs(server, /^\/ws$/, onConn);
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping(() => {});
    }
  }, 30000);
  if (timer.unref) timer.unref();
});
