// Smoke-тест WS-событий «Эхо». Сервер должен быть запущен (порт 3011 или PORT).
// Запуск: node scripts/ws-smoke.mjs
import WebSocket from 'ws';

const BASE = 'http://127.0.0.1:' + (process.env.PORT || 3011);
let failures = 0;

function ok(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

async function login(name) {
  const res = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('login failed: ' + res.status);
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie');
  const cookie = setCookie.split(';')[0];
  const { user } = await res.json();
  return { cookie, user };
}

function connect(cookie) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws', { headers: { Cookie: cookie } });
    const events = [];
    ws.on('open', () => resolve({ ws, events }));
    ws.on('message', (raw) => { try { events.push(JSON.parse(String(raw))); } catch { /* ignore */ } });
    ws.on('error', reject);
  });
}

function waitFor(events, pred, label, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const found = events.find(pred);
      if (found) return resolve(found);
      if (Date.now() - t0 > ms) return reject(new Error('timeout: ' + label));
      setTimeout(tick, 50);
    };
    tick();
  });
}

const suffix = Math.random().toString(36).slice(2, 8);
const A = await login('smokeA_' + suffix);
const B = await login('smokeB_' + suffix);
console.log('Пользователи:', A.user.name, '/', B.user.name);

// 401 без куки
const noauth = await fetch(BASE + '/api/servers');
ok('REST 401 без куки', noauth.status === 401);

// A создаёт сервер, B входит по коду
const created = await (await fetch(BASE + '/api/servers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: A.cookie },
  body: JSON.stringify({ name: 'Smoke ' + suffix }),
})).json();
ok('создание сервера', !!created.server && !!created.server.invite_code);

const joined = await (await fetch(BASE + '/api/servers/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: B.cookie },
  body: JSON.stringify({ code: created.server.invite_code }),
})).json();
ok('вход по коду приглашения', !!joined.server && joined.server.id === created.server.id);

const info = await (await fetch(BASE + '/api/servers/' + created.server.id, { headers: { Cookie: A.cookie } })).json();
const textCh = info.channels.find((c) => c.kind === 'text');
const voiceCh = info.channels.find((c) => c.kind === 'voice');
ok('каналы по умолчанию (text + voice)', !!textCh && !!voiceCh && info.channels.length === 2);
ok('в сервере двое участников', info.members.length === 2);

// B подключается первым, затем A — B должен получить presence с A онлайн
const b = await connect(B.cookie);
const a = await connect(A.cookie);
const evPresence = await waitFor(b.events, (e) => e.type === 'presence' && (e.online || []).includes(A.user.id), 'presence');
ok('presence: B видит A в сети', !!evPresence);

// POST сообщения -> broadcast message:new
const post = await (await fetch(BASE + '/api/channels/' + textCh.id + '/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: A.cookie },
  body: JSON.stringify({ text: 'привет из smoke-теста' }),
})).json();
ok('REST: отправка сообщения', !!post.message);
const evNew = await waitFor(b.events, (e) => e.type === 'message:new' && e.message.id === post.message.id, 'message:new');
ok('WS: B получил message:new', evNew.message.text === 'привет из smoke-теста' && evNew.message.user_name === A.user.name);

// typing
await fetch(BASE + '/api/channels/' + textCh.id + '/typing', { method: 'POST', headers: { Cookie: A.cookie } });
const evTyping = await waitFor(b.events, (e) => e.type === 'typing' && e.channelId === textCh.id, 'typing');
ok('WS: B получил typing', evTyping.userName === A.user.name && evTyping.until > Date.now());

// voice:join -> occupancy
a.ws.send(JSON.stringify({ type: 'voice:join', channelId: voiceCh.id }));
const evJoin = await waitFor(b.events, (e) => e.type === 'voice:join' && e.channelId === voiceCh.id, 'voice:join');
ok('WS: B получил voice:join с occupancy', evJoin.userId === A.user.id && (evJoin.occupants || []).some((o) => o.userId === A.user.id));

// voice:signal — релеинг сигналинга A -> B
a.ws.send(JSON.stringify({ type: 'voice:signal', to: B.user.id, data: { probe: 1 } }));
const evSig = await waitFor(b.events, (e) => e.type === 'voice:signal' && e.from === A.user.id, 'voice:signal');
ok('WS: B получил voice:signal от A', evSig.data && evSig.data.probe === 1);

// voice:leave
a.ws.send(JSON.stringify({ type: 'voice:leave' }));
const evLeave = await waitFor(b.events, (e) => e.type === 'voice:leave' && e.channelId === voiceCh.id, 'voice:leave');
ok('WS: B получил voice:leave, комната пуста', evLeave.userId === A.user.id && (evLeave.occupants || []).length === 0);

// heartbeat ack
a.ws.send(JSON.stringify({ type: 'heartbeat' }));
const evHb = await waitFor(a.events, (e) => e.type === 'heartbeat', 'heartbeat ack');
ok('WS: heartbeat подтверждается сервером', typeof evHb.t === 'number');

a.ws.close();
b.ws.close();

console.log(failures ? 'SMOKE: ' + failures + ' провалов' : 'SMOKE: все проверки пройдены');
process.exit(failures ? 1 : 0);
