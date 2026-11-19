// «Эхо» — клиент. Один модуль, без сборки.
'use strict';

// ---------- Мелкие помощники ----------
const $ = (sel, root = document) => root.querySelector(sel);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  dm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V11.5A8.5 8.5 0 0 1 11.5 3h1A8.5 8.5 0 0 1 21 11.5z"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M3 3l18 18"/></svg>',
  phoneOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.5.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.36 1.75.7 2.55a2 2 0 0 1-.45 2.11l-1.27 1.27M22 2 2 22"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18l1-9-5.5 3.5L12 4 7.5 11.5 2 8z"/><path d="M3 21h18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

function icon(name) { return ICONS[name] || ''; }

const AVA_COLORS = ['#5865f2', '#23a55a', '#c2410c', '#b158b1', '#0e7490', '#a16207', '#be4a4a', '#4f6d7a'];
function avaHtml(name, cls = '', id = '') {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const color = AVA_COLORS[h % AVA_COLORS.length];
  return `<div class="ava ${cls}" ${id ? `data-id="${esc(id)}"` : ''} style="--ava-bg:${color}" title="${esc(name)}">${esc(letter)}</div>`;
}
function hueFor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVA_COLORS[h % AVA_COLORS.length];
}

function fmtTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + hm;
}

// Приводим строку dm_messages к виду обычного сообщения
function normalizeDm(d) {
  return { id: d.id, user_id: d.from_id, user_name: d.from_name, text: d.text, created: d.created, to_id: d.to_id };
}

function toast(text, kind = 'ok') {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' err' : '');
  t.textContent = text;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => t.remove(), 3600);
}

const ERRS = {
  unauthorized: 'Требуется вход',
  forbidden: 'Недостаточно прав',
  not_found: 'Не найдено',
  need_name: 'Введите имя или название',
  need_code: 'Введите код приглашения',
  bad_kind: 'Выберите тип канала',
  too_long: 'Текст длиннее 2000 символов',
  empty_message: 'Сообщение пустое',
  server_not_found: 'Сервер с таким кодом не найден',
  not_text_channel: 'В голосовом канале нет текстового чата',
  no_self_dm: 'Нельзя написать самому себе',
  payload_too_large: 'Слишком большой запрос',
};
function toastErr(e) {
  toast(ERRS[e && e.code] || ('Ошибка: ' + (e && e.message ? e.message : e)), 'err');
}

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(url, opt);
  let data = {};
  try { data = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok) {
    const err = new Error(data.error || ('HTTP ' + res.status));
    err.code = data.error;
    throw err;
  }
  return data;
}

// ---------- Состояние ----------
const state = {
  me: null,
  ws: null,
  hbTimer: null,
  online: new Set(),
  servers: [],
  serverId: null,
  serverData: null,      // {server, channels, members}
  channelId: null,
  dmMode: false,
  dmPeer: null,
  dialogs: [],
  messages: [],          // по возрастанию created
  hasMore: false,
  loadingOlder: false,
  typing: new Map(),     // userName -> until
  typingTimer: null,
  occupancy: new Map(),  // channelId -> [{userId, userName}]
  voice: null,           // {channelId, stream, actx, gain, dest, outTrack, pc:Map, audio:Map, muted}
  lastTypingSent: 0,
  chanToDelete: null,
};

// ---------- WebSocket ----------
function wsSend(obj) {
  if (state.ws && state.ws.readyState === 1) state.ws.send(JSON.stringify(obj));
}

function connectWs() {
  if (state.ws) {
    state.ws.onclose = null;
    clearInterval(state.hbTimer);
    try { state.ws.close(); } catch { /* уже закрыт */ }
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(proto + '://' + location.host + '/ws');
  state.ws = ws;
  ws.onopen = () => {
    wsSend({ type: 'heartbeat' });
    clearInterval(state.hbTimer);
    state.hbTimer = setInterval(() => wsSend({ type: 'heartbeat' }), 25000);
  };
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m && m.type) onWsEvent(m);
  };
  ws.onclose = () => {
    clearInterval(state.hbTimer);
    setTimeout(() => { if (state.me) connectWs(); }, 2000);
  };
  ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
}

function onWsEvent(m) {
  switch (m.type) {
    case 'presence': {
      state.online = new Set(m.online || []);
      state.online.add(state.me.id);
      renderMembers();
      if (state.dmMode) renderDmList();
      // в сети появился кто-то, кого нет в списке участников, — подтягиваем данные сервера
      if (!state.dmMode && state.serverData) {
        const known = new Set(state.serverData.members.map((x) => x.id));
        for (const id of state.online) {
          if (!known.has(id)) { refreshServerData(); break; }
        }
      }
      break;
    }
    case 'message:new': {
      state.typing.delete(m.message.user_name);
      renderTyping();
      if (!state.dmMode && m.message.channel_id === state.channelId) {
        appendMessage(m.message);
      }
      break;
    }
    case 'message:edit': {
      const i = state.messages.findIndex((x) => x.id === m.message.id);
      if (i >= 0) { state.messages[i] = m.message; renderMessages(); }
      break;
    }
    case 'message:delete': {
      const i = state.messages.findIndex((x) => x.id === m.id);
      if (i >= 0) { state.messages.splice(i, 1); renderMessages(); }
      break;
    }
    case 'dm:new': {
      const msg = normalizeDm(m.message);
      const mine = msg.user_id === state.me.id;
      const peerId = mine ? msg.to_id : msg.from_id;
      if (state.dmMode && state.dmPeer && state.dmPeer.id === peerId) {
        appendMessage(msg);
      } else {
        loadDmList();
        if (!mine) toast('Новое личное сообщение от ' + msg.user_name);
      }
      break;
    }
    case 'typing': {
      if (!state.dmMode && m.channelId === state.channelId) {
        state.typing.set(m.userName, m.until);
        renderTyping();
      }
      break;
    }
    case 'channel:new': {
      if (m.serverId === state.serverId) refreshServerData();
      break;
    }
    case 'channel:delete': {
      if (m.serverId === state.serverId) {
        if (state.channelId === m.channelId) {
          state.channelId = null;
          state.messages = [];
        }
        refreshServerData();
      }
      break;
    }
    case 'voice:join': {
      state.occupancy.set(m.channelId, m.occupants || []);
      renderChannels();
      if (state.voice && m.channelId === state.voice.channelId && m.userId === state.me.id) {
        for (const o of m.occupants || []) {
          if (o.userId !== state.me.id && !state.voice.pc.has(o.userId)) createPeer(o.userId, true);
        }
      }
      break;
    }
    case 'voice:leave': {
      state.occupancy.set(m.channelId, m.occupants || []);
      if (state.voice && m.userId !== state.me.id) closePeer(m.userId);
      renderChannels();
      break;
    }
    case 'voice:error': {
      toast('Не удалось зайти в голосовую комнату', 'err');
      break;
    }
    case 'voice:signal': {
      handleVoiceSignal(m).catch(() => {});
      break;
    }
    case 'heartbeat':
    default:
      break;
  }
}

// ---------- Вход ----------
function showAuth() {
  $('#auth').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#authName').focus();
}

async function init() {
  $('#sendBtn').innerHTML = icon('send');
  $('#logoutBtn').innerHTML = icon('logout');
  try {
    const { user } = await api('GET', '/api/me');
    if (user) return enterApp(user);
  } catch { /* не залогинен */ }
  showAuth();
}

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#authName').value.trim();
  if (!name) return toast('Введите имя', 'err');
  try {
    const { user } = await api('POST', '/api/login', { name });
    enterApp(user);
  } catch (err) { toastErr(err); }
});

async function enterApp(user) {
  state.me = user;
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#meName').textContent = user.name;
  const meAva = $('#meAva');
  meAva.textContent = String(user.name).trim().charAt(0).toUpperCase() || '?';
  meAva.style.setProperty('--ava-bg', hueFor(user.name));
  await loadServers();
  connectWs();
}

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('POST', '/api/logout'); } catch { /* ignore */ }
  location.reload();
});

// ---------- Рельс серверов ----------
async function loadServers() {
  try {
    state.servers = (await api('GET', '/api/servers')).servers;
  } catch (e) { toastErr(e); state.servers = []; }
  renderRail();
  if (!state.dmMode && !state.serverId) {
    if (state.servers.length) await openServer(state.servers[0].id);
    else switchToDm();
  } else {
    renderChannels();
  }
}

function renderRail() {
  const rail = $('#rail');
  const parts = [];
  parts.push(
    `<button class="rail-item ${state.dmMode ? 'active' : ''}" id="railDm" title="Личные сообщения">${icon('dm')}</button>`
  );
  parts.push('<div class="rail-sep"></div>');
  for (const s of state.servers) {
    const active = !state.dmMode && s.id === state.serverId;
    parts.push(
      `<button class="rail-item ${active ? 'active' : ''}" data-sid="${s.id}" title="${esc(s.name)}">${esc(s.name.charAt(0).toUpperCase())}</button>`
    );
  }
  parts.push(`<button class="rail-item" id="railAdd" title="Создать сервер или войти по коду">${icon('plus')}</button>`);
  rail.innerHTML = parts.join('');
  $('#railDm').addEventListener('click', switchToDm);
  $('#railAdd').addEventListener('click', openServerModal);
  for (const btn of rail.querySelectorAll('[data-sid]')) {
    btn.addEventListener('click', () => openServer(btn.dataset.sid));
  }
}

// ---------- Открытие сервера ----------
async function openServer(id) {
  state.dmMode = false;
  state.dmPeer = null;
  state.serverId = id;
  state.channelId = null;
  state.messages = [];
  await refreshServerData(true);
  renderRail();
}

async function refreshServerData(pickFirst = false) {
  if (!state.serverId) return;
  try {
    const d = await api('GET', '/api/servers/' + state.serverId);
    state.serverData = d;
    for (const ch of d.channels) {
      if (ch.kind === 'voice') state.occupancy.set(ch.id, ch.occupancy || []);
    }
    if (pickFirst || !state.channelId) {
      const first = d.channels.find((c) => c.kind === 'text');
      if (first) await openChannel(first.id);
      else { state.channelId = null; renderChatHead(); renderMessages(); }
    }
    renderChannels();
    renderMembers();
  } catch (e) { toastErr(e); }
}

// ---------- Левая колонка: каналы ----------
function renderChannels() {
  const head = $('#sideHead');
  const body = $('#sideBody');
  if (state.dmMode) { renderDmList(); return; }
  if (!state.serverData) { head.innerHTML = ''; body.innerHTML = ''; return; }
  const srv = state.serverData.server;
  const isOwner = srv.owner_id === state.me.id;
  head.innerHTML = `<div class="title">${esc(srv.name)}</div>`;
  const texts = state.serverData.channels.filter((c) => c.kind === 'text');
  const voices = state.serverData.channels.filter((c) => c.kind === 'voice');

  let html = `<div class="side-label"><span class="grow">Текстовые каналы</span>
    <button id="addChannel" title="Создать канал">${icon('plus')}</button></div>`;
  for (const ch of texts) {
    html += `<div class="chan ${ch.id === state.channelId ? 'active' : ''}" data-cid="${ch.id}" title="${esc(ch.name)}">
      ${icon('hash')}<span class="name">${esc(ch.name)}</span>
      ${isOwner ? `<button class="del ${state.chanToDelete === ch.id ? 'confirm' : ''}" data-del="${ch.id}" title="Удалить канал">${state.chanToDelete === ch.id ? icon('check') : icon('trash')}</button>` : ''}
    </div>`;
  }
  html += `<div class="side-label"><span class="grow">Голосовые каналы</span></div>`;
  for (const ch of voices) {
    const occ = state.occupancy.get(ch.id) || ch.occupancy || [];
    const inVoice = state.voice && state.voice.channelId === ch.id;
    html += `<div class="chan ${inVoice ? 'active' : ''}" data-voice="${ch.id}" title="Зайти в голос: ${esc(ch.name)}">
      ${icon('volume')}<span class="name">${esc(ch.name)}</span>
      ${isOwner ? `<button class="del ${state.chanToDelete === ch.id ? 'confirm' : ''}" data-del="${ch.id}" title="Удалить канал">${state.chanToDelete === ch.id ? icon('check') : icon('trash')}</button>` : ''}
    </div>`;
    if (occ.length) {
      html += `<div class="voice-occ">` + occ.map((o) =>
        `<div class="occ">${avaHtml(o.userName, 'tiny')}${esc(o.userName)}</div>`
      ).join('') + `</div>`;
    }
  }
  if (!texts.length && !voices.length) html += `<div class="side-empty">Каналов пока нет. Создайте первый.</div>`;
  body.innerHTML = html;

  $('#addChannel')?.addEventListener('click', openChannelModal);
  for (const el of body.querySelectorAll('.chan[data-cid]')) {
    el.addEventListener('click', () => openChannel(el.dataset.cid));
  }
  for (const el of body.querySelectorAll('.chan[data-voice]')) {
    el.addEventListener('click', () => joinVoice(el.dataset.voice));
  }
  for (const btn of body.querySelectorAll('.del[data-del]')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChannelFlow(btn.dataset.del);
    });
  }
}

async function deleteChannelFlow(id) {
  if (state.chanToDelete !== id) {
    state.chanToDelete = id;
    renderChannels();
    setTimeout(() => {
      if (state.chanToDelete === id) { state.chanToDelete = null; renderChannels(); }
    }, 3000);
    return;
  }
  state.chanToDelete = null;
  try {
    await api('DELETE', '/api/channels/' + id);
  } catch (e) { toastErr(e); }
}

// ---------- Каналы: открытие и сообщения ----------
async function openChannel(id) {
  const ch = state.serverData && state.serverData.channels.find((c) => c.id === id);
  state.channelId = id;
  state.dmMode = false;
  state.typing.clear();
  renderChannels();
  renderChatHead();
  renderTyping();
  if (ch && ch.kind === 'voice') {
    state.messages = [];
    state.hasMore = false;
    renderMessages();
    renderVoiceState();
    return;
  }
  renderVoiceState();
  try {
    const d = await api('GET', `/api/channels/${id}/messages?limit=50`);
    state.messages = d.messages;
    state.hasMore = d.hasMore;
    renderMessages(true);
  } catch (e) { toastErr(e); }
}

function currentChannel() {
  return state.serverData && state.serverData.channels.find((c) => c.id === state.channelId);
}

function renderChatHead() {
  const head = $('#chatHead');
  if (state.dmMode && state.dmPeer) {
    const on = state.online.has(state.dmPeer.id);
    head.innerHTML = `${avaHtml(state.dmPeer.name, 'small')}
      <span class="title">${esc(state.dmPeer.name)}</span>
      <span class="status"><span class="dot ${on ? 'on' : ''}"></span>${on ? 'в сети' : 'не в сети'}</span>
      <span class="spacer"></span>`;
    return;
  }
  const ch = currentChannel();
  if (!state.serverData || !ch) { head.innerHTML = `<span class="title">Эхо</span><span class="spacer"></span>`; return; }
  const srv = state.serverData.server;
  head.innerHTML =
    (ch.kind === 'voice' ? icon('volume') : icon('hash')) +
    `<span class="title">${esc(ch.name)}</span>
     <span class="spacer"></span>` +
    `<button class="invite-chip" id="inviteBtn" title="Скопировать код приглашения">${icon('link')}Код ${esc(srv.invite_code)}</button>`;
  $('#inviteBtn')?.addEventListener('click', () => copyInvite(srv.invite_code));
}

function copyInvite(code) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code)
      .then(() => toast('Код скопирован: ' + code))
      .catch(() => showCodeModal(code));
  } else {
    showCodeModal(code);
  }
}

// ---------- Лента сообщений ----------
function appendMessage(m) {
  state.messages.push(m);
  const sc = $('#chatScroll');
  const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140;
  renderMessages();
  if (nearBottom) sc.scrollTop = sc.scrollHeight;
}

function messageHtml(m, prev) {
  const mine = m.user_id === state.me.id;
  const continued = prev && prev.user_id === m.user_id && (m.created - prev.created) < 5 * 60 * 1000;
  const color = hueFor(m.user_name || m.user_id);
  let text = esc(m.text);
  let actions = '';
  if (mine && !state.dmMode) { // правка/удаление — только в каналах сервера
    actions = `<div class="m-actions">
      <button data-act="edit" data-id="${m.id}" title="Изменить">${icon('pencil')}</button>
      <button data-act="del" data-id="${m.id}" title="Удалить">${icon('trash')}</button>
    </div>`;
  }
  return `<div class="msg ${continued ? 'continued' : ''}" data-mid="${m.id}">
    ${continued ? `<div class="ava" style="visibility:hidden"></div>` : avaHtml(m.user_name, '', '')}
    <div class="m-body">
      <div class="m-head">
        <span class="m-name" style="--name-color:${color}">${esc(m.user_name)}</span>
        <span class="m-time">${fmtTime(m.created)}</span>
        ${m.edited_at ? '<span class="m-edited">(изменено)</span>' : ''}
      </div>
      <div class="m-text">${text}</div>
    </div>
    ${actions}
  </div>`;
}

function renderMessages(scrollToBottom = false) {
  const box = $('#messages');
  const empty = $('#emptyState');
  const view = state.messages.slice(-100); // окно ~100 сообщений
  if (!view.length) {
    box.innerHTML = '';
    const ch = currentChannel();
    if (state.dmMode && state.dmPeer) {
      empty.innerHTML = `<h3>Диалог с ${esc(state.dmPeer.name)}</h3><p>Сообщений пока нет — напишите первое.</p>`;
      empty.classList.remove('hidden');
    } else if (ch && ch.kind === 'voice') {
      empty.innerHTML = `<h3>${esc(ch.name)}</h3>
        <p>Голосовая комната. Здесь нет текстового чата.</p>
        <button class="big-join" id="bigJoin">Зайти в голос</button>`;
      empty.classList.remove('hidden');
      $('#bigJoin').addEventListener('click', () => joinVoice(ch.id));
    } else if (ch) {
      empty.innerHTML = `<h3>${icon('hash')} Добро пожаловать в «${esc(ch.name)}»</h3><p>Это начало канала.</p>`;
      empty.classList.remove('hidden');
    } else {
      empty.innerHTML = `<h3>Выберите канал</h3>`;
      empty.classList.remove('hidden');
    }
    $('#loadMore').classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  let prev = null;
  box.innerHTML = view.map((m) => { const html = messageHtml(m, prev); prev = m; return html; }).join('');
  $('#loadMore').classList.toggle('hidden', !state.hasMore);
  if (scrollToBottom) {
    const sc = $('#chatScroll');
    sc.scrollTop = sc.scrollHeight;
  }
}

$('#loadMore').addEventListener('click', loadOlder);

async function loadOlder() {
  if (state.loadingOlder || !state.hasMore) return;
  state.loadingOlder = true;
  const sc = $('#chatScroll');
  const prevH = sc.scrollHeight;
  const prevTop = sc.scrollTop;
  const before = state.messages.length ? state.messages[0].created : Date.now();
  try {
    const d = state.dmMode && state.dmPeer
      ? await api('GET', `/api/dm/${state.dmPeer.id}/messages?before=${before}&limit=50`)
      : await api('GET', `/api/channels/${state.channelId}/messages?before=${before}&limit=50`);
    const older = state.dmMode ? d.messages.map(normalizeDm) : d.messages;
    state.messages = older.concat(state.messages);
    state.hasMore = d.hasMore;
    renderMessages();
    sc.scrollTop = sc.scrollHeight - prevH + prevTop;
  } catch (e) { toastErr(e); }
  state.loadingOlder = false;
}

// Действия над сообщениями (делегирование)
$('#messages').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const mid = btn.dataset.id;
  const msgEl = btn.closest('.msg');
  const msg = state.messages.find((m) => m.id === mid);
  if (!msg || !msgEl) return;
  const act = btn.dataset.act;

  if (act === 'del') {
    const body = msgEl.querySelector('.m-text');
    body.innerHTML = `<span class="m-confirm">Удалить сообщение?
      <button class="yes" data-act="del-yes" data-id="${mid}">Удалить</button>
      <button data-act="del-no" data-id="${mid}">Отмена</button></span>`;
  } else if (act === 'del-yes') {
    try { await api('DELETE', '/api/messages/' + mid); } catch (err) { toastErr(err); }
  } else if (act === 'del-no') {
    renderMessages();
  } else if (act === 'edit') {
    const body = msgEl.querySelector('.m-text');
    body.innerHTML = `<div class="m-edit">
      <textarea>${esc(msg.text)}</textarea>
      <div class="row"><button data-act="cancel-edit" data-id="${mid}">Отмена</button>
      <button class="save" data-act="save-edit" data-id="${mid}">Сохранить</button></div>
    </div>`;
    const ta = body.querySelector('textarea');
    ta.focus();
    ta.selectionStart = ta.value.length;
  } else if (act === 'cancel-edit') {
    renderMessages();
  } else if (act === 'save-edit') {
    const text = msgEl.querySelector('textarea').value.trim();
    if (!text) return toast('Сообщение пустое', 'err');
    if (text.length > 2000) return toast('Текст длиннее 2000 символов', 'err');
    try { await api('PATCH', '/api/messages/' + mid, { text }); } catch (err) { toastErr(err); }
  }
});

// ---------- Композер ----------
const inputEl = $('#input');
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
inputEl.addEventListener('input', () => {
  // авто-высота
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  maybeSendTyping();
});
$('#sendBtn').addEventListener('click', sendMessage);

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  if (text.length > 2000) return toast('Текст длиннее 2000 символов', 'err');
  if (state.dmMode && state.dmPeer) {
    inputEl.value = ''; inputEl.style.height = 'auto';
    api('POST', `/api/dm/${state.dmPeer.id}`, { text }).catch((e) => { inputEl.value = text; toastErr(e); });
  } else if (!state.dmMode && currentChannel() && currentChannel().kind === 'text') {
    inputEl.value = ''; inputEl.style.height = 'auto';
    api('POST', `/api/channels/${state.channelId}/messages`, { text }).catch((e) => { inputEl.value = text; toastErr(e); });
  }
  state.typing.delete(state.me.name);
  renderTyping();
}

function maybeSendTyping() {
  if (state.dmMode || !state.channelId) return;
  const ch = currentChannel();
  if (!ch || ch.kind !== 'text') return;
  const t = Date.now();
  if (t - state.lastTypingSent < 2000) return;
  state.lastTypingSent = t;
  api('POST', `/api/channels/${state.channelId}/typing`).catch(() => {});
}

function renderTyping() {
  const box = $('#typing');
  const t = Date.now();
  for (const [n, until] of state.typing) if (until < t) state.typing.delete(n);
  const names = [...state.typing.keys()];
  if (!names.length) { box.textContent = ''; return; }
  box.textContent =
    names.length === 1 ? names[0] + ' печатает…'
    : names.length === 2 ? names[0] + ' и ' + names[1] + ' печатают…'
    : 'Несколько человек печатают…';
  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(renderTyping, 1000);
}

// ---------- Правая колонка ----------
function renderMembers() {
  const box = $('#members');
  if (state.dmMode) {
    box.innerHTML = `<div class="side-empty">Список участников относится к серверам. Чтобы начать диалог, выберите человека в диалогах слева или в списке участников сервера.</div>`;
    return;
  }
  if (!state.serverData) { box.innerHTML = ''; return; }
  const ms = state.serverData.members
    .map((m) => ({ ...m, online: state.online.has(m.id) }))
    .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name, 'ru'));
  const online = ms.filter((m) => m.online);
  const offline = ms.filter((m) => !m.online);
  const row = (m) => `
    <div class="member ${m.online ? '' : 'offline'}" data-uid="${m.id}" title="Написать ${esc(m.name)}">
      ${avaHtml(m.name, 'small')}
      <span class="name">${esc(m.name)}</span>
      ${m.role === 'owner' ? `<span class="role" title="Владелец сервера">${icon('crown')}</span>` : ''}
      <span class="dot ${m.online ? 'on' : ''}"></span>
    </div>`;
  let html = '';
  if (online.length) html += `<div class="mem-group">В сети — ${online.length}</div>` + online.map(row).join('');
  if (offline.length) html += `<div class="mem-group">Не в сети — ${offline.length}</div>` + offline.map(row).join('');
  if (!ms.length) html = `<div class="side-empty">Участников нет</div>`;
  box.innerHTML = html;
  for (const el of box.querySelectorAll('.member[data-uid]')) {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      if (uid !== state.me.id) openDm(uid);
    });
  }
}

// ---------- ЛС ----------
function switchToDm() {
  state.dmMode = true;
  state.dmPeer = null;
  state.channelId = null;
  state.messages = [];
  state.hasMore = false;
  state.typing.clear();
  renderRail();
  renderDmList();
  renderChatHead();
  renderMessages();
  renderMembers();
  renderTyping();
  loadDmList();
}

async function loadDmList() {
  try {
    state.dialogs = (await api('GET', '/api/dm')).dialogs;
    if (state.dmMode) renderDmList();
  } catch (e) { /* тихо: список обновится позже */ }
}

function renderDmList() {
  const head = $('#sideHead');
  const body = $('#sideBody');
  if (!state.dmMode) return;
  head.innerHTML = `<div class="title">Личные сообщения</div>`;
  let html = '';
  if (state.dialogs.length) {
    html = state.dialogs.map((d) => `
      <div class="dm-row ${state.dmPeer && state.dmPeer.id === d.userId ? 'active' : ''}" data-uid="${d.userId}">
        ${avaHtml(d.name, 'small')}
        <div class="info">
          <div class="row-top"><span class="row-name">${esc(d.name)}</span><span class="dot ${d.online ? 'on' : ''}"></span><span class="row-time">${fmtTime(d.lastAt)}</span></div>
          <div class="row-snippet">${esc(d.lastText)}</div>
        </div>
      </div>`).join('');
  } else {
    html = `<div class="side-empty">Диалогов пока нет. Откройте список участников сервера и нажмите на человека, чтобы написать ему.</div>`;
  }
  body.innerHTML = html;
  for (const el of body.querySelectorAll('.dm-row[data-uid]')) {
    el.addEventListener('click', () => openDm(el.dataset.uid));
  }
}

async function openDm(userId) {
  try {
    const d = await api('GET', `/api/dm/${userId}/messages`);
    state.dmMode = true;
    state.dmPeer = d.peer;
    if (!state.dialogs.some((x) => x.userId === d.peer.id)) {
      state.dialogs.unshift({ userId: d.peer.id, name: d.peer.name, lastText: '', lastAt: Date.now(), online: state.online.has(d.peer.id) });
    }
    state.channelId = null;
    state.messages = d.messages.map(normalizeDm);
    state.hasMore = d.hasMore;
    state.typing.clear();
    renderRail();
    renderDmList();
    renderChatHead();
    renderMessages(true);
    renderMembers();
    renderTyping();
    inputEl.focus();
  } catch (e) { toastErr(e); }
}

// ---------- Голос ----------
async function joinVoice(channelId) {
  if (!window.isSecureContext) {
    toast('Голос работает только по https-ссылке', 'err');
    return;
  }
  if (state.voice) {
    if (state.voice.channelId === channelId) return;
    leaveVoice();
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast('Нет доступа к микрофону', 'err');
    return;
  }
  const ch = state.serverData && state.serverData.channels.find((c) => c.id === channelId);
  let actx, gain, dest;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaStreamSource(stream);
    gain = actx.createGain();
    gain.gain.value = 1;
    dest = actx.createMediaStreamDestination();
    src.connect(gain);
    gain.connect(dest);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return toast('Не удалось запустить аудио', 'err');
  }
  state.voice = {
    channelId,
    stream, actx, gain, dest,
    outTrack: dest.stream.getAudioTracks()[0],
    pc: new Map(),
    audio: new Map(),
    muted: false,
  };
  wsSend({ type: 'voice:join', channelId });
  renderChannels();
  renderVoicePanel();
  if (state.channelId === channelId) renderMessages();
}

function leaveVoice() {
  const v = state.voice;
  if (!v) return;
  wsSend({ type: 'voice:leave', channelId: v.channelId });
  for (const [uid, pc] of v.pc) {
    try { pc.close(); } catch { /* ignore */ }
  }
  for (const [, audio] of v.audio) {
    try { audio.srcObject = null; audio.remove(); } catch { /* ignore */ }
  }
  v.stream.getTracks().forEach((t) => t.stop());
  try { v.actx.close(); } catch { /* ignore */ }
  state.voice = null;
  renderChannels();
  renderVoicePanel();
  if (state.channelId === v.channelId) renderMessages();
}

function createPeer(peerId, initiator) {
  const v = state.voice;
  if (!v || v.pc.has(peerId)) return v ? v.pc.get(peerId) : null;
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  v.pc.set(peerId, pc);
  const audio = new Audio();
  audio.autoplay = true;
  audio.style.display = 'none';
  document.body.appendChild(audio);
  v.audio.set(peerId, audio);
  pc.addTrack(v.outTrack, v.dest.stream);
  pc.onicecandidate = (e) => {
    if (e.candidate) wsSend({ type: 'voice:signal', to: peerId, data: { candidate: e.candidate.toJSON() } });
  };
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
    audio.play().catch(() => {});
  };
  if (initiator) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => wsSend({ type: 'voice:signal', to: peerId, data: { sdp: pc.localDescription } }))
      .catch(() => {});
  }
  return pc;
}

function closePeer(peerId) {
  const v = state.voice;
  if (!v) return;
  const pc = v.pc.get(peerId);
  if (pc) { try { pc.close(); } catch { /* ignore */ } v.pc.delete(peerId); }
  const audio = v.audio.get(peerId);
  if (audio) { try { audio.srcObject = null; audio.remove(); } catch { /* ignore */ } v.audio.delete(peerId); }
}

async function handleVoiceSignal(m) {
  const v = state.voice;
  if (!v) return;
  const from = m.from;
  const data = m.data || {};
  if (!from || from === state.me.id) return;
  let pc = v.pc.get(from);
  if (data.sdp && data.sdp.type === 'offer') {
    if (!pc) pc = createPeer(from, false);
    await pc.setRemoteDescription(data.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsSend({ type: 'voice:signal', to: from, data: { sdp: pc.localDescription } });
  } else if (data.sdp && data.sdp.type === 'answer') {
    if (pc && pc.signalingState === 'have-local-offer') await pc.setRemoteDescription(data.sdp);
  } else if (data.candidate) {
    if (!pc) pc = createPeer(from, false);
    try { await pc.addIceCandidate(data.candidate); } catch { /* кандидат не подошёл */ }
  }
}

function toggleMute() {
  const v = state.voice;
  if (!v) return;
  v.muted = !v.muted;
  v.gain.gain.value = v.muted ? 0 : 1;
  renderVoicePanel();
}

function voiceRoomName(channelId) {
  const ch = state.serverData && state.serverData.channels.find((c) => c.id === channelId);
  return ch ? ch.name : 'Голосовая комната';
}

function renderVoicePanel() {
  const panel = $('#voicePanel');
  const v = state.voice;
  if (!v) { panel.classList.add('hidden'); panel.innerHTML = ''; return; }
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="vp-info">
      <div class="vp-room">${esc(voiceRoomName(v.channelId))}</div>
      <div class="vp-status">${v.muted ? 'Микрофон выключен' : 'Голос подключён'}</div>
    </div>
    <button class="icon-btn ${v.muted ? '' : 'accent'}" id="muteBtn" title="${v.muted ? 'Включить микрофон' : 'Выключить микрофон'}">${icon(v.muted ? 'micOff' : 'mic')}</button>
    <button class="icon-btn danger" id="leaveVoiceBtn" title="Покинуть комнату">${icon('phoneOff')}</button>`;
  $('#muteBtn').addEventListener('click', toggleMute);
  $('#leaveVoiceBtn').addEventListener('click', leaveVoice);
}

function renderVoiceState() { renderVoicePanel(); }

// ---------- Модальные окна ----------
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="overlay" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center"><div class="modal">${html}</div></div>`;
  root.classList.remove('hidden');
  const close = () => { root.classList.add('hidden'); root.innerHTML = ''; };
  root.querySelector('.overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  document.onkeydown = (e) => { if (e.key === 'Escape') close(); };
  return { root, close };
}

function openServerModal() {
  const { close } = openModal(`
    <h3>Создать сервер</h3>
    <label>Название</label>
    <input id="mName" maxlength="64" placeholder="Например: Друзья">
    <button class="btn accent" id="mCreate">Создать</button>
    <div class="modal-sep"></div>
    <h3>Присоединиться по коду</h3>
    <label>Код приглашения</label>
    <input id="mCode" maxlength="16" placeholder="Например: DEMO">
    <button class="btn" id="mJoin">Войти</button>
  `);
  const create = async () => {
    const name = $('#mName', document).value.trim();
    if (!name) return toast('Введите название сервера', 'err');
    try {
      const { server } = await api('POST', '/api/servers', { name });
      close();
      state.serverId = server.id;
      state.channelId = null;
      await loadServers();
      await openServer(server.id);
    } catch (e) { toastErr(e); }
  };
  const join = async () => {
    const code = $('#mCode', document).value.trim();
    if (!code) return toast('Введите код приглашения', 'err');
    try {
      const { server } = await api('POST', '/api/servers/join', { code });
      close();
      if (!state.servers.some((s) => s.id === server.id)) state.servers.push(server);
      state.serverId = server.id;
      state.channelId = null;
      await loadServers();
      await openServer(server.id);
      toast('Вы присоединились к «' + server.name + '»');
    } catch (e) { toastErr(e); }
  };
  $('#mCreate', document).addEventListener('click', create);
  $('#mJoin', document).addEventListener('click', join);
  for (const id of ['mName', 'mCode']) {
    $('#' + id, document).addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.id === 'mName' ? create() : join(); });
  }
  $('#mName', document).focus();
}

function openChannelModal() {
  if (!state.serverData) return;
  const { close } = openModal(`
    <h3>Новый канал</h3>
    <label>Название</label>
    <input id="mChName" maxlength="32" placeholder="Например: анонсы">
    <div class="kind-row">
      <button class="kind-btn sel" data-kind="text">${icon('hash')}Текстовый</button>
      <button class="kind-btn" data-kind="voice">${icon('volume')}Голосовой</button>
    </div>
    <button class="btn accent" id="mChCreate">Создать канал</button>
  `);
  let kind = 'text';
  for (const btn of document.querySelectorAll('.kind-btn')) {
    btn.addEventListener('click', () => {
      kind = btn.dataset.kind;
      document.querySelectorAll('.kind-btn').forEach((b) => b.classList.toggle('sel', b === btn));
    });
  }
  const create = async () => {
    const name = $('#mChName', document).value.trim();
    if (!name) return toast('Введите название канала', 'err');
    try {
      await api('POST', `/api/servers/${state.serverId}/channels`, { name, kind });
      close();
    } catch (e) { toastErr(e); }
  };
  $('#mChCreate', document).addEventListener('click', create);
  $('#mChName', document).addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
  $('#mChName', document).focus();
}

function showCodeModal(code) {
  const { close } = openModal(`
    <h3>Код приглашения</h3>
    <div class="code-view">${esc(code)}</div>
    <p class="side-empty" style="padding:0 0 12px">Скопируйте код вручную и передайте другу: он нажмёт «плюс» на панели серверов и введёт его.</p>
    <button class="btn" id="mCodeClose">Закрыть</button>
  `);
  $('#mCodeClose', document).addEventListener('click', close);
}

// ---------- Старт ----------
init();
