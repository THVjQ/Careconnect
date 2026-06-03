// ════════════════════════════════════════════════════════════
// CareConnect — Reports Page
// ════════════════════════════════════════════════════════════
'use strict';

Router.register('reports', {
  roles: ['admin', 'staff', 'client'],
  render: renderReports,
});

async function renderReports(container) {
  const role = State.get('user').role;

  if (role === ROLES.ADMIN)  return _adminReports(container);
  if (role === ROLES.STAFF)  return _staffReports(container);
  if (role === ROLES.CLIENT) return _clientInfo(container);
}

/* ─── Admin ──────────────────────────────────────────────── */
async function _adminReports(container) {
  const clients = await API.clients.getAll();

  container.innerHTML = `
    <div class="page-header"><h2>Reports</h2></div>
    <div class="form-group">
      <label class="form-label">Select Client</label>
      <select class="form-input" onchange="_loadClientReport(this.value)">
        <option value="">Choose a client…</option>
        ${clients.map(c => `<option value="${c.id}">${c.expand?.user_id?.name ?? c.id}</option>`).join('')}
      </select>
    </div>
    <div id="report-area">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Select a client above</h3>
      </div>
    </div>`;
}

async function _loadClientReport(clientId) {
  if (!clientId) return;
  const area = document.getElementById('report-area');
  area.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    const [client, goals, shiftReports, incidents] = await Promise.all([
      API.clients.getOne(clientId),
      API.goals.getForClient(clientId),
      API.reports.getForClient(clientId),
      API.incidents.getForClient(clientId),
    ]);

    const cu = client.expand?.user_id;

    area.innerHTML = `
      <!-- Tabs -->
      <div class="flex gap-2 mb-4" style="border-bottom:1px solid var(--color-border);padding-bottom:12px">
        <button class="btn btn-accent btn-sm" id="t-info"      onclick="_rTab('info')">Client Info</button>
        <button class="btn btn-ghost btn-sm"  id="t-shifts"    onclick="_rTab('shifts')">Shift Reports</button>
        <button class="btn btn-ghost btn-sm"  id="t-incidents" onclick="_rTab('incidents')">Incidents</button>
      </div>

      <!-- Client info -->
      <div id="tab-info">
        <div class="card mb-4">
          <div class="card-header"><h3 class="card-title">👤 ${cu?.name ?? 'Client'}</h3></div>
          ${client.allergies ? `<div class="alert alert-error">⚠️ <strong>Allergies:</strong> ${client.allergies}</div>` : ''}
          ${_infoRow('Additional Needs',    client.additional_needs)}
          ${_infoRow('Communication Notes', client.communication_notes)}
        </div>
        <div class="card mb-4">
          <div class="card-header">
            <h3 class="card-title">🎯 Goals</h3>
            <button class="btn btn-accent btn-sm" onclick="_addGoal('${clientId}')">+ Add Goal</button>
          </div>
          ${goals.length === 0 ? '<p class="text-muted text-sm">No goals set.</p>'
            : goals.map(g => `
              <div class="list-item">
                <div style="flex:1">
                  <div class="list-item-label">${g.title}</div>
                  ${g.description ? `<div class="list-item-sub">${g.description}</div>` : ''}
                </div>
                <button class="btn btn-ghost btn-sm" onclick="_deleteGoal('${g.id}','${clientId}')">🗑</button>
              </div>`).join('')}
        </div>
      </div>

      <!-- Shift reports -->
      <div id="tab-shifts" class="hidden">
        ${shiftReports.items.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No reports yet</h3></div>'
          : shiftReports.items.map(r => `
            <div class="card mb-4">
              <div class="card-header">
                <div>
                  <div class="font-bold text-sm">${new Date(r.created).toLocaleDateString('en-AU')}</div>
                  <div class="text-muted text-sm">by ${r.expand?.submitted_by?.name ?? 'Staff'}</div>
                </div>
                <span class="chip chip-success">Submitted</span>
              </div>
              <p style="font-size:var(--text-sm)">${r.notes ?? ''}</p>
            </div>`).join('')}
      </div>

      <!-- Incidents -->
      <div id="tab-incidents" class="hidden">
        <button class="btn btn-danger btn-sm mb-4" onclick="_logIncident('${clientId}')">+ Log Incident</button>
        ${incidents.length === 0
          ? '<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No incidents</h3></div>'
          : incidents.map(i => `
            <div class="card mb-4">
              <div class="card-header">
                <div>
                  <div class="font-bold text-sm">${new Date(i.reported_at).toLocaleDateString('en-AU')}</div>
                  <div class="text-muted text-sm">by ${i.expand?.reported_by?.name ?? 'Staff'}</div>
                </div>
                <span class="chip chip-${i.severity==='high'?'danger':i.severity==='medium'?'warning':'grey'}">${i.severity ?? 'low'}</span>
              </div>
              <p style="font-size:var(--text-sm)">${i.description}</p>
            </div>`).join('')}
      </div>`;

  } catch (err) {
    area.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function _rTab(name) {
  ['info','shifts','incidents'].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('hidden', t !== name);
    document.getElementById(`t-${t}`)?.classList.replace(
      t === name ? 'btn-ghost' : 'btn-accent',
      t === name ? 'btn-accent' : 'btn-ghost'
    );
  });
}
function _infoRow(label, value) {
  return value ? `<div class="form-group"><div class="form-label">${label}</div><div style="font-size:var(--text-sm)">${value}</div></div>` : '';
}

async function _addGoal(clientId) {
  Modal.open({
    title: 'Add Goal',
    content: `
      <div class="form-group"><label class="form-label">Goal</label><input class="form-input" id="g-title" placeholder="e.g. Improve communication skills"></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="g-desc" rows="2"></textarea></div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Add',    style: 'primary', onClick: async () => {
        const title = document.getElementById('g-title').value.trim();
        if (!title) { Toast.error('Please enter a goal'); return; }
        await API.goals.create(clientId, title, document.getElementById('g-desc').value.trim());
        Modal.close();
        Toast.success('Goal added ✓');
        _loadClientReport(clientId);
      }},
    ],
  });
}

async function _deleteGoal(goalId, clientId) {
  if (!await Modal.confirm('Delete goal?', 'This cannot be undone.', 'Delete', true)) return;
  await API.goals.delete(goalId);
  Toast.success('Goal removed');
  _loadClientReport(clientId);
}

async function _logIncident(clientId) {
  Modal.open({
    title: 'Log Incident',
    content: `
      <div class="form-group"><label class="form-label">Severity</label>
        <select class="form-input" id="inc-sev">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="inc-desc" rows="4"></textarea></div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Log',    style: 'danger', onClick: async () => {
        const desc = document.getElementById('inc-desc').value.trim();
        if (!desc) { Toast.error('Please describe the incident'); return; }
        await API.incidents.create({ client_id: clientId, severity: document.getElementById('inc-sev').value, description: desc });
        Modal.close();
        Toast.success('Incident logged ✓');
        _loadClientReport(clientId);
      }},
    ],
  });
}

/* ─── Staff ──────────────────────────────────────────────── */
async function _staffReports(container) {
  const user = State.get('user');
  let sp;
  try { sp = await API.staff.getByUser(user.id); } catch {}

  const today  = new Date();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const iso = d => d.toISOString().split('T')[0];

  const shifts = sp ? await API.shifts.getForStaff(sp.id, iso(weekAgo), iso(today)) : [];
  const pending = shifts.filter(s => s.status === SHIFT_STATUS.COMPLETED && !s.report_completed);
  const done    = shifts.filter(s => s.report_completed);

  container.innerHTML = `
    <div class="page-header"><h2>My Reports</h2></div>
    ${pending.length
      ? `<div class="alert alert-warning">⚠️ ${pending.length} report${pending.length>1?'s':''} outstanding</div>`
      : `<div class="alert alert-success">✓ All reports up to date!</div>`}

    <div class="section-label mb-3">Pending</div>
    ${pending.length === 0
      ? '<p class="text-muted text-sm">Nothing due.</p>'
      : pending.map(s => `
        <div class="shift-card pending" onclick="_openReportForm('${s.id}')">
          <div class="shift-card-top">
            <div>
              <div class="shift-time">${s.date} · ${s.start_time}–${s.end_time}</div>
              <div class="shift-subtitle">Tap to complete →</div>
            </div>
            <span class="chip chip-warning">Due</span>
          </div>
        </div>`).join('')}

    <div class="section-label mt-4 mb-3">Completed This Week</div>
    ${done.length === 0
      ? '<p class="text-muted text-sm">None yet.</p>'
      : done.map(s => `
        <div class="shift-card completed">
          <div class="shift-card-top">
            <div class="shift-time">${s.date}</div>
            <span class="chip chip-success">✓ Submitted</span>
          </div>
        </div>`).join('')}`;
}

async function _openReportForm(shiftId) {
  Modal.open({
    title: 'Shift Report',
    content: `
      <div class="alert alert-warning text-sm">⚠️ Reports cannot be changed once submitted.</div>
      <div class="form-group"><label class="form-label">Shift Notes</label>
        <textarea class="form-input" id="rn-notes" rows="5" placeholder="How did the shift go? Activities done? Any observations…"></textarea>
      </div>
      <div class="form-group"><label class="form-label">Client Mood / Wellbeing</label>
        <select class="form-input" id="rn-mood">
          <option value="">Select…</option>
          <option value="great">😊 Great</option>
          <option value="good">🙂 Good</option>
          <option value="okay">😐 Okay</option>
          <option value="difficult">😔 Difficult</option>
        </select>
      </div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Submit Report', style: 'primary', onClick: async (btn) => {
        const notes = document.getElementById('rn-notes').value.trim();
        if (!notes) { Toast.error('Please add shift notes'); return; }
        btn.disabled = true; btn.textContent = 'Submitting…';
        try {
          await API.reports.submit({ shift_id: shiftId, notes, mood: document.getElementById('rn-mood').value });
          Modal.close();
          Toast.success('Report submitted ✓');
          Events.emit('report:submitted', { shiftId });
          renderReports(document.getElementById('main-content'));
        } catch (err) {
          Toast.error(err.message);
          btn.disabled = false; btn.textContent = 'Submit Report';
        }
      }},
    ],
  });
}

/* ─── Client ─────────────────────────────────────────────── */
async function _clientInfo(container) {
  const user = State.get('user');
  let cp;
  try { cp = await API.clients.getByUser(user.id); } catch {}

  if (!cp) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><h3>Profile not set up yet</h3><p>Contact your coordinator.</p></div>`;
    return;
  }

  const [goals, updates] = await Promise.all([
    API.goals.getForClient(cp.id),
    API.reports.getForClient(cp.id, 1, 5),
  ]);

  container.innerHTML = `
    <div class="page-header"><h2>My Information</h2></div>
    ${cp.allergies ? `<div class="alert alert-error">⚠️ <strong>Allergies:</strong> ${cp.allergies}</div>` : ''}
    <div class="card mb-4">
      <h3 class="card-title mb-4">🎯 My Goals</h3>
      ${goals.length === 0 ? '<p class="text-muted text-sm">No goals set yet.</p>'
        : goals.map(g => `<div class="list-item"><div class="list-item-label">${g.title}</div></div>`).join('')}
    </div>
    <div class="card">
      <h3 class="card-title mb-4">📋 Recent Updates</h3>
      ${updates.items.length === 0 ? '<p class="text-muted text-sm">No updates yet.</p>'
        : updates.items.map(r => `
          <div style="padding:12px 0;border-bottom:1px solid var(--color-border)">
            <div class="text-muted text-sm mb-1">${new Date(r.created).toLocaleDateString('en-AU')}</div>
            <div style="font-size:var(--text-sm)">${r.notes}</div>
          </div>`).join('')}
    </div>`;
}


// ════════════════════════════════════════════════════════════
// CareConnect — Messaging Page
// ════════════════════════════════════════════════════════════

let _msgRoomId    = null;
let _msgUnsub     = null;

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
      <div class="bubble-text">${_esc(msg.content)}</div>
      <div style="font-size:0.65rem;color:var(--color-text-light);padding:0 4px">${_relTime(msg.created)}</div>
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
        const room = await API.messaging.createRoom(name, type, [State.get('user').id, ...checked]);
        Modal.close();
        Toast.success(`"${name}" created ✓`);
        renderMessaging(document.getElementById('main-content'));
      }},
    ],
  });
}

function _esc(str) {
  return (str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
function _relTime(str) {
  if (!str) return '';
  const m = Math.floor((Date.now() - new Date(str)) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}


// ════════════════════════════════════════════════════════════
// CareConnect — Account Page
// ════════════════════════════════════════════════════════════

Router.register('account', {
  roles: ['admin', 'staff', 'client'],
  render: renderAccount,
});

async function renderAccount(container) {
  const user = State.get('user');

  container.innerHTML = `
    <div class="profile-header">
      <div style="position:relative;display:inline-block">
        <div class="avatar avatar-lg" id="acct-avatar" style="margin:0 auto;background:var(--color-role-${user.role})">
          ${_initials(user.name || user.email)}
        </div>
        <button onclick="_uploadAvatar()" style="position:absolute;bottom:0;right:0;width:26px;height:26px;background:var(--color-accent);border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:0.7rem" aria-label="Change photo">📷</button>
        <input type="file" id="avatar-file" accept="image/*" style="display:none" onchange="_handleAvatarFile(event)">
      </div>
      <div class="profile-name">${user.name || 'Your Name'}</div>
      <div class="profile-role-text">${user.email}</div>
      <div class="mt-2"><span class="role-badge ${user.role}">${user.role}</span></div>
    </div>

    <!-- Personal Details -->
    <div class="card mb-4">
      <div class="card-header">
        <h3 class="card-title">Personal Details</h3>
        <button class="btn btn-ghost btn-sm" onclick="_toggleNameEdit()">Edit</button>
      </div>
      <div id="name-view">
        <div class="list-item"><div><div class="list-item-label">Full Name</div><div class="list-item-sub" id="display-name">${user.name || '—'}</div></div></div>
        <div class="list-item" style="border:none"><div><div class="list-item-label">Email</div><div class="list-item-sub">${user.email}</div></div></div>
      </div>
      <div id="name-edit" class="hidden">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="name-input" value="${user.name || ''}"></div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="_saveName()">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="_toggleNameEdit()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Password -->
    <div class="card mb-4">
      <div class="card-header"><h3 class="card-title">🔒 Change Password</h3></div>
      <div class="form-group"><label class="form-label">Current Password</label><input class="form-input" type="password" id="pw-old" placeholder="Current password"></div>
      <div class="form-group"><label class="form-label">New Password</label><input class="form-input" type="password" id="pw-new" placeholder="At least 8 characters"></div>
      <div class="form-group"><label class="form-label">Confirm New</label><input class="form-input" type="password" id="pw-confirm" placeholder="Repeat new password"></div>
      <div id="pw-msg"></div>
      <button class="btn btn-primary" onclick="_changePw()">Update Password</button>
    </div>

    <!-- Biometric -->
    <div class="card mb-4">
      <div class="card-header"><h3 class="card-title">🔐 Biometric Login</h3></div>
      ${Auth.hasBiometric()
        ? `<p class="text-muted text-sm mb-4" style="color:var(--color-success)">✓ Enabled on this device</p>
           <button class="btn btn-danger btn-sm" onclick="_removeBio()">Remove Biometric</button>`
        : `<p class="text-muted text-sm mb-4">Not set up on this device.</p>
           <button class="btn btn-accent btn-sm" onclick="_setupBio()">Set Up Biometric</button>`}
    </div>

    <!-- Sign out -->
    <div class="card" style="border-color:var(--color-danger)">
      <button class="btn btn-danger" onclick="Auth.logout()">Sign Out</button>
    </div>`;
}

function _toggleNameEdit() {
  document.getElementById('name-view').classList.toggle('hidden');
  document.getElementById('name-edit').classList.toggle('hidden');
}
async function _saveName() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { Toast.error('Please enter a name'); return; }
  await API.users.update(State.get('user').id, { name });
  State.merge('user', { name });
  document.getElementById('display-name').textContent = name;
  _toggleNameEdit();
  Toast.success('Name updated ✓');
}
function _uploadAvatar() { document.getElementById('avatar-file').click(); }
async function _handleAvatarFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { Toast.error('Max 5MB'); return; }
  await API.users.updateAvatar(State.get('user').id, file);
  Toast.success('Photo updated ✓');
}
async function _changePw() {
  const old = document.getElementById('pw-old').value;
  const nw  = document.getElementById('pw-new').value;
  const cfm = document.getElementById('pw-confirm').value;
  const msg = document.getElementById('pw-msg');
  if (!old || !nw || !cfm) { msg.className='alert alert-error'; msg.textContent='Fill in all fields'; return; }
  if (nw.length < 8) { msg.className='alert alert-error'; msg.textContent='Minimum 8 characters'; return; }
  if (nw !== cfm) { msg.className='alert alert-error'; msg.textContent='Passwords don\'t match'; return; }
  try {
    await API.users.changePassword(State.get('user').id, old, nw);
    msg.className='alert alert-success'; msg.textContent='Password updated ✓';
    ['pw-old','pw-new','pw-confirm'].forEach(id => document.getElementById(id).value='');
  } catch (err) {
    msg.className='alert alert-error'; msg.textContent=err.data?.message || err.message;
  }
}
async function _setupBio() {
  try { await Auth.registerBiometric(State.get('user')); Toast.success('Biometric enabled ✓'); renderAccount(document.getElementById('main-content')); }
  catch (err) { if (err.name !== 'NotAllowedError') Toast.error('Setup failed'); }
}
function _removeBio() { Auth.removeBiometric(); Toast.show('Biometric removed'); renderAccount(document.getElementById('main-content')); }
function _initials(name) { return name.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?'; }


// ════════════════════════════════════════════════════════════
// CareConnect — Settings Page
// ════════════════════════════════════════════════════════════

Router.register('settings', {
  roles: ['admin'],
  render: renderSettings,
});

Router.register('notifications', {
  roles: ['admin','staff','client'],
  render: renderNotifications,
});

Router.register('clients', {
  roles: ['admin'],
  render: renderClients,
});

async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Settings</h2></div>

    <div class="section-label mb-3">🔔 Notifications</div>
    <div class="card mb-4">
      ${_toggleRow('Shift Reminders',        'pref_shift_remind',   true,  'Remind before shift starts')}
      ${_toggleRow('Report Due Reminders',   'pref_report_remind',  true,  'Remind staff to complete reports')}
      ${_toggleRow('New Messages',           'pref_msg_notif',      true,  'Alerts for new chat messages')}
      ${_toggleRow('Auto Post-Shift Remind', 'admin_post_shift',    true,  'Auto-notify staff after each shift (admin)')}
    </div>

    <div class="section-label mb-3">🎨 Theme</div>
    <div class="card mb-4">
      <div class="list-item" style="border:none">
        <div><div class="list-item-label">Colour Scheme</div><div class="list-item-sub">App-wide colour</div></div>
        <select class="form-input" style="width:auto" onchange="_applyTheme(this.value)">
          ${[['navy','Navy (Default)'],['teal','Teal'],['purple','Purple'],['green','Green']].map(([v,l])=>`<option value="${v}" ${State.getSetting('theme','navy')===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="section-label mb-3">ℹ️ About</div>
    <div class="card mb-4">
      <div class="list-item"><div class="list-item-label">Version</div><div class="list-item-sub">${APP.VERSION}</div></div>
      <div class="list-item"><div class="list-item-label">Server</div><div class="list-item-sub" style="word-break:break-all;font-size:0.75rem">${APP.PB_URL}</div></div>
      <div class="list-item" style="border:none"><div class="list-item-label">Support</div><div><button class="link-btn" onclick="BugReport.show()">Report a bug</button></div></div>
    </div>

    <div class="section-label mb-3">⚙️ Data</div>
    <div class="card">
      <div class="list-item" style="border:none">
        <div><div class="list-item-label">Clear Cached Data</div><div class="list-item-sub">Remove offline cache from this device</div></div>
        <button class="btn btn-outline btn-sm" onclick="_clearCache()">Clear</button>
      </div>
    </div>`;
}

function _toggleRow(label, key, defaultVal, sub) {
  const checked = State.getSetting(key, defaultVal);
  return `<div class="list-item">
    <div style="flex:1"><div class="list-item-label">${label}</div><div class="list-item-sub">${sub}</div></div>
    <label class="toggle">
      <input type="checkbox" ${checked?'checked':''} onchange="State.setSetting('${key}', this.checked)">
      <span class="toggle-track"></span>
    </label>
  </div>`;
}

const THEMES = {
  navy:   { '--color-primary': '#1e3a5f', '--color-primary-light': '#2d5a8e' },
  teal:   { '--color-primary': '#0f766e', '--color-primary-light': '#0d9488' },
  purple: { '--color-primary': '#5b21b6', '--color-primary-light': '#7c3aed' },
  green:  { '--color-primary': '#065f46', '--color-primary-light': '#059669' },
};

function _applyTheme(name) {
  const t = THEMES[name] || THEMES.navy;
  Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  State.setSetting('theme', name);
  Toast.success(`Theme: ${name} ✓`);
}

// Apply saved theme on startup
(function () {
  const saved = State.getSetting('theme', 'navy');
  if (saved !== 'navy') _applyTheme(saved);
})();

async function _clearCache() {
  if (!await Modal.confirm('Clear cache?', 'This removes offline data from this device.', 'Clear')) return;
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  Toast.success('Cache cleared ✓');
}

/* ─── Notifications page ─────────────────────────────────── */
async function renderNotifications(container) {
  const user = State.get('user');
  const { items } = await API.notifications.getForUser(user.id);
  await API.notifications.markAllRead(user.id);
  State.set('unreadNotifs', 0);
  document.getElementById('notif-badge')?.classList.add('hidden');

  container.innerHTML = `
    <div class="page-header">
      <h2>Notifications</h2>
    </div>
    ${items.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">🔔</div><h3>All caught up!</h3></div>'
      : `<div class="card">
          ${items.map(n => `
            <div class="list-item ${n.read ? '' : ''}" style="${!n.read ? 'background:var(--color-primary-xlt);margin:0 -20px;padding:12px 20px;border-radius:var(--radius-sm)' : ''}">
              <div style="font-size:1.2rem">${n.read ? '📩' : '🔔'}</div>
              <div style="flex:1">
                <div class="list-item-label">${n.title}</div>
                <div class="list-item-sub">${n.body}</div>
                <div style="font-size:0.7rem;color:var(--color-text-light);margin-top:2px">${_relTime(n.created)}</div>
              </div>
            </div>`).join('')}
        </div>`}`;
}

/* ─── Clients list page ──────────────────────────────────── */
async function renderClients(container) {
  const clients = await API.clients.getAll();
  container.innerHTML = `
    <div class="page-header"><h2>Clients</h2></div>
    ${clients.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No clients yet</h3></div>'
      : clients.map(c => {
          const u = c.expand?.user_id;
          return `<div class="card card-clickable mb-4" onclick="Router.go('reports')">
            <div class="flex items-center gap-3">
              <div class="avatar avatar-md" style="background:var(--color-role-client)">${(u?.name||'C')[0].toUpperCase()}</div>
              <div>
                <div class="font-bold">${u?.name || 'Unknown'}</div>
                <div class="text-muted text-sm">${u?.email || ''}</div>
                ${c.allergies ? '<span class="chip chip-danger mt-2">⚠️ Allergies</span>' : ''}
              </div>
            </div>
          </div>`;
        }).join('')}`;
}
