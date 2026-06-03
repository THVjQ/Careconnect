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

