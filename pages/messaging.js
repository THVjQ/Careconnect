// ════════════════════════════════════════════════════════════
// CareConnect — Messaging Page
// ════════════════════════════════════════════════════════════

'use strict';

let _msgRoomId = null;
let _msgUnsub  = null;

Router.register('messaging', {
  roles:   ['admin', 'staff', 'client'],
  render:  renderMessaging,
  cleanup: () => { _msgUnsub?.(); API.messaging.unsubscribeMessages(); },
});

async function renderMessaging(container) {
  const user = State.get('user');
  let rooms  = [];
  try { rooms = await API.messaging.getRooms(user.id); } catch {}

  container.style.padding = '0';

  container.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar" id="msg-sidebar">
        <div style="padding:16px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:800">Messages</span>
          ${user.role === ROLES.ADMIN ? `<button class="btn btn-accent btn-sm" onclick="_newRoom()">+</button>` : ''}
        </div>
        <div style="flex:1;overflow-y:auto">
          ${rooms.length === 0
            ? '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">💬</div><h3>No chats yet</h3></div>'
            : rooms.map(r => `
              <div class="room-item" id="room-${r.id}" onclick="_openRoom('${r.id}')">
                <div class="avatar avatar-sm" style="background:var(--color-primary)">${(r.name||'R')[0].toUpperCase()}</div>
                <div style="flex:1;overflow:hidden">
                  <div style="font-weight:700;font-size:var(--text-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name || 'Chat'}</div>
                  <div class="text-muted text-sm">${r.type}</div>
                </div>
              </div>`).join('')}
        </div>
      </div>
      <div class="flex flex-col" id="msg-main" style="flex:1;background:var(--color-bg)">
        <div class="empty-state" style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column">
          <div class="empty-state-icon">💬</div>
          <h3>Select a conversation</h3>
        </div>
      </div>
    </div>`;

  // Auto-open first room on desktop
  if (rooms.length > 0 && window.innerWidth >= 600) _openRoom(rooms[0].id);
}

async function _openRoom(roomId) {
  _msgRoomId = roomId;
  if (_msgUnsub) { _msgUnsub(); _msgUnsub = null; }
  API.messaging.unsubscribeMessages();

  document.querySelectorAll('.room-item').forEach(el => el.classList.toggle('active', el.id === `room-${roomId}`));

  const main = document.getElementById('msg-main');
  main.innerHTML = `
    <div style="padding:12px 16px;background:var(--color-surface);border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:12px">
      <button class="icon-btn" onclick="_msgBackToList()" style="color:var(--color-text-muted)">${ICONS.back}</button>
      <span style="font-weight:800">Chat</span>
    </div>
    <div id="msg-list" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px">
      <div class="page-loading"><div class="spinner"></div></div>
    </div>
    <div style="padding:12px 16px;background:var(--color-surface);border-top:1px solid var(--color-border);display:flex;gap:8px;align-items:flex-end">
      <textarea id="msg-input" class="chat-input" style="flex:1;resize:none;border:2px solid var(--color-border);border-radius:20px;padding:9px 14px;font-size:var(--text-sm);outline:none;font-family:var(--font-body);max-height:100px;transition:border-color var(--duration) var(--ease)" placeholder="Type a message…" rows="1"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_msgSend()}"
                oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
      <button onclick="_msgSend()" style="width:40px;height:40px;border-radius:50%;background:var(--color-accent);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${ICONS.send}
      </button>
    </div>`;

  // Load messages
  const listEl = document.getElementById('msg-list');
  try {
    const { items } = await API.messaging.getMessages(roomId);
    const me = State.get('user').id;
    listEl.innerHTML = items.length === 0
      ? '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">👋</div><h3>Start the conversation!</h3></div>'
      : items.map(m => _renderMsg(m, me)).join('');
    listEl.scrollTop = listEl.scrollHeight;
  } catch { listEl.innerHTML = '<div class="alert alert-error">Failed to load messages</div>'; }

  // Subscribe to new messages
  API.messaging.subscribeMessages(roomId, (msg) => {
    const empty = listEl.querySelector('.empty-state');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.innerHTML = _renderMsg(msg, State.get('user').id);
    listEl.appendChild(div.firstElementChild);
    listEl.scrollTop = listEl.scrollHeight;
  });
}

function _renderMsg(msg, myId) {
  const isMine   = msg.sender_id === myId || msg.expand?.sender_id?.id === myId;
  const sender   = msg.expand?.sender_id;
  const initials = (sender?.name || sender?.email || '?')[0].toUpperCase();
  return `<div class="bubble ${isMine ? 'mine' : ''}" style="align-self:${isMine?'flex-end':'flex-start'}">
    <div class="avatar avatar-xs" style="background:var(--color-primary);align-self:flex-end">${initials}</div>
    <div style="display:flex;flex-direction:column;gap:3px">
      ${!isMine ? `<div style="font-size:0.7rem;font-weight:700;color:var(--color-text-muted);padding:0 4px">${sender?.name||sender?.email||'?'}</div>` : ''}
      <div class="bubble-text">${_msgEsc(msg.content)}</div>
      <div style="font-size:0.65rem;color:var(--color-text-light);padding:0 4px">${_msgRelTime(msg.created)}</div>
    </div>
  </div>`;
}

async function _msgSend() {
  const input   = document.getElementById('msg-input');
  const content = input?.value.trim();
  if (!content || !_msgRoomId) return;
  input.value = '';
  input.style.height = 'auto';
  try { await API.messaging.sendMessage(_msgRoomId, content); }
  catch { Toast.error('Failed to send'); input.value = content; }
}

function _msgBackToList() {
  const sidebar = document.getElementById('msg-sidebar');
  const main    = document.getElementById('msg-main');
  if (sidebar) { sidebar.style.display = ''; }
  if (main)    { main.style.display = 'none'; }
}

async function _newRoom() {
  let allUsers = [];
  try {
    const [staff, clients] = await Promise.all([API.staff.getAll(), API.clients.getAll()]);
    allUsers = [
      ...staff.map(s => ({ id: s.expand?.user_id?.id, name: s.expand?.user_id?.name || s.expand?.user_id?.email, role: 'staff' })),
      ...clients.map(c => ({ id: c.expand?.user_id?.id, name: c.expand?.user_id?.name || c.expand?.user_id?.email, role: 'client' })),
    ].filter(u => u.id && u.id !== State.get('user').id);
  } catch {}

  Modal.open({
    title: 'New Chat Room',
    content: `
      <div class="form-group"><label class="form-label">Room Name</label><input class="form-input" id="nr-name" placeholder="e.g. Client Support Team"></div>
      <div class="form-group"><label class="form-label">Type</label>
        <select class="form-input" id="nr-type">
          <option value="client_team">👥 Client Team</option>
          <option value="fill_staff">🔄 Fill-in Staff</option>
          <option value="admin">🔐 Admin</option>
          <option value="direct">💬 Direct</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Members</label>
        <div style="max-height:180px;overflow-y:auto;border:2px solid var(--color-border);border-radius:var(--radius-sm);padding:8px">
          ${allUsers.map(u => `
            <label class="list-item" style="padding:8px 0;cursor:pointer">
              <input type="checkbox" value="${u.id}" style="margin-right:8px">
              <span style="flex:1">${u.name}</span>
              <span class="chip chip-${u.role==='staff'?'info':'success'}">${u.role}</span>
            </label>`).join('')}
        </div>
      </div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Create', style: 'primary', onClick: async () => {
        const name    = document.getElementById('nr-name').value.trim();
        const type    = document.getElementById('nr-type').value;
        const checked = [...document.querySelectorAll('#modal-body input[type=checkbox]:checked')].map(c => c.value);
        if (!name || checked.length === 0) { Toast.error('Enter a name and add at least one member'); return; }
        await API.messaging.createRoom(name, type, [State.get('user').id, ...checked]);
        Modal.close();
        Toast.success(`"${name}" created ✓`);
        renderMessaging(document.getElementById('main-content'));
      }},
    ],
  });
}

function _msgEsc(str) {
  return (str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
function _msgRelTime(str) {
  if (!str) return '';
  const m = Math.floor((Date.now() - new Date(str)) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
