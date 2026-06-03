// ════════════════════════════════════════════════════════════
// CareConnect — Roster Page
// ════════════════════════════════════════════════════════════

'use strict';

let _rosterWeekOffset = 0;
let _rosterCleanup    = null;

Router.register('roster', {
  roles:   ['admin', 'staff', 'client'],
  render:  renderRoster,
  cleanup: () => { _rosterCleanup?.(); },
});

async function renderRoster(container) {
  _rosterWeekOffset = 0;
  await _loadRoster(container);
}

async function _loadRoster(container) {
  const user = State.get('user');
  const role = user.role;

  const weekStart = _weekStart(_rosterWeekOffset);
  const weekEnd   = _weekStart(_rosterWeekOffset + 2); // show 2 weeks
  const endDate   = new Date(weekEnd); endDate.setDate(endDate.getDate() - 1);

  container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

  try {
    let shifts = [];
    let staffProfile  = null;
    let clientProfile = null;
    let allClients    = [];

    if (role === ROLES.ADMIN) {
      [shifts, allClients] = await Promise.all([
        API.shifts.getForWeek(_iso(weekStart), _iso(endDate)),
        API.clients.getAll(),
      ]);
    } else if (role === ROLES.STAFF) {
      staffProfile = await API.staff.getByUser(user.id).catch(() => null);
      if (staffProfile) shifts = await API.shifts.getForStaff(staffProfile.id, _iso(weekStart), _iso(endDate));
    } else if (role === ROLES.CLIENT) {
      clientProfile = await API.clients.getByUser(user.id).catch(() => null);
      if (clientProfile) shifts = await API.shifts.getForClient(clientProfile.id, _iso(weekStart), _iso(endDate));
    }

    _renderRosterUI(container, { role, user, shifts, allClients, staffProfile, clientProfile, weekStart, endDate });

  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">Failed to load roster: ${err.message}</div>`;
  }
}

function _renderRosterUI(container, { role, user, shifts, allClients, weekStart, endDate }) {
  const canGoBack = _rosterWeekOffset > -1;
  const maxFwd    = role === ROLES.ADMIN ? 12 : 1;
  const canGoFwd  = _rosterWeekOffset < maxFwd;

  const rangeLabel = `${_fmtShort(weekStart)} – ${_fmtShort(endDate)}`;

  container.innerHTML = `
    <div class="section-header mb-4">
      <button class="btn btn-ghost btn-sm btn-icon" onclick="_rosterNav(-1)" ${!canGoBack ? 'disabled style="opacity:0.3"' : ''}>
        ${ICONS.back}
      </button>
      <h3 style="font-weight:800">${rangeLabel}</h3>
      <button class="btn btn-ghost btn-sm btn-icon" onclick="_rosterNav(1)" ${!canGoFwd ? 'disabled style="opacity:0.3"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    ${role === ROLES.ADMIN ? `
    <div class="flex gap-2 mb-4">
      <button class="btn btn-accent btn-sm" onclick="_rosterAddShift()">+ Add Shift</button>
    </div>` : ''}

    ${role === ROLES.CLIENT ? `
    <div class="flex gap-2 mb-4">
      <button class="btn btn-accent btn-sm" onclick="_rosterRequestShift()">Request a Shift</button>
    </div>` : ''}

    ${role === ROLES.STAFF ? `
    <div class="flex gap-2 mb-4">
      <button class="btn btn-outline btn-sm" onclick="_rosterSetUnavailable()">Mark Unavailable</button>
    </div>` : ''}

    <!-- Week grids -->
    ${_buildTwoWeekView(shifts, allClients, role, weekStart)}`;
}

function _buildTwoWeekView(shifts, allClients, role, weekStart) {
  const days     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dates    = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const week1 = dates.slice(0, 7);
  const week2 = dates.slice(7);

  const buildWeek = (weekDates, weekLabel) => {
    const headers = weekDates.map((d, i) => `
      <div class="day-header ${_isToday(d) ? 'today' : ''}">
        <div>${days[i]}</div>
        <div style="font-weight:900">${d.getDate()}</div>
      </div>`).join('');

    let rows = '';

    if (role === ROLES.ADMIN && allClients.length > 0) {
      rows = allClients.map(client => {
        const clientUser = client.expand?.user_id;
        const label      = `<div class="roster-row-label">${clientUser?.name?.split(' ')[0] ?? 'Client'}</div>`;
        const cells      = weekDates.map(d => _buildCell(shifts, d, client.id, null, role)).join('');
        return label + cells;
      }).join('');
    } else {
      rows = weekDates.map(d => _buildCell(shifts, d, null, null, role)).join('');
    }

    const cols = role === ROLES.ADMIN && allClients.length > 0
      ? `grid-template-columns:80px repeat(7,1fr)`
      : `grid-template-columns:repeat(7,1fr)`;

    return `
      <div class="section-label mb-2">${weekLabel}</div>
      <div class="roster-scroll mb-4">
        <div class="week-grid" style="${cols}">
          ${role === ROLES.ADMIN && allClients.length > 0 ? '<div></div>' : ''}
          ${headers}${rows}
        </div>
      </div>`;
  };

  const w1Label = `Week 1 — ${_fmtShort(week1[0])} – ${_fmtShort(week1[6])}`;
  const w2Label = `Week 2 — ${_fmtShort(week2[0])} – ${_fmtShort(week2[6])}`;

  return buildWeek(week1, w1Label) + buildWeek(week2, w2Label);
}

function _buildCell(shifts, date, clientId, staffId, role) {
  const dateStr = _iso(date);
  const past    = _isPast(date);
  const cellShifts = shifts.filter(s =>
    s.date === dateStr &&
    (!clientId || s.client_id === clientId)
  );

  const pills = cellShifts.map(s => {
    const css = s.status === SHIFT_STATUS.COMPLETED ? 'completed' : s.status === SHIFT_STATUS.CANCELLED ? 'cancelled' : '';
    return `<div class="shift-pill ${css}" onclick="event.stopPropagation(); _openShiftDetail('${s.id}')">${_fmtTime(s.start_time)}</div>`;
  }).join('');

  const click = !past && role === ROLES.ADMIN
    ? `onclick="_rosterCellClick('${dateStr}','${clientId ?? ''}')"` : '';

  return `<div class="roster-cell ${past ? 'past' : ''}" ${click}>${pills}</div>`;
}

// ── Actions (called from inline onclick) ──────────────────
async function _rosterNav(dir) {
  _rosterWeekOffset += dir;
  await _loadRoster(document.getElementById('main-content'));
}

async function _rosterAddShift() {
  const clients = await API.clients.getAll();
  Modal.open({
    title: 'Add Shift',
    content: `
      <div class="form-group">
        <label class="form-label">Client</label>
        <select class="form-input" id="ns-client">
          <option value="">Select client…</option>
          ${clients.map(c => `<option value="${c.id}">${c.expand?.user_id?.name ?? c.id}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Date</label>
        <input class="form-input" type="date" id="ns-date" value="${_iso(new Date())}">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Start</label>
          <input class="form-input" type="time" id="ns-start" value="09:00">
        </div>
        <div class="form-group">
          <label class="form-label">End</label>
          <input class="form-input" type="time" id="ns-end" value="15:00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input" id="ns-notes" rows="2" placeholder="Optional…"></textarea>
      </div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Create', style: 'primary', onClick: async () => {
        const clientId = document.getElementById('ns-client').value;
        const date     = document.getElementById('ns-date').value;
        const start    = document.getElementById('ns-start').value;
        const end      = document.getElementById('ns-end').value;
        const notes    = document.getElementById('ns-notes').value;
        if (!clientId || !date) { Toast.error('Please fill in all required fields'); return; }
        await API.shifts.create({ client_id: clientId, date, start_time: start, end_time: end, notes });
        Modal.close();
        Toast.success('Shift created ✓');
        Events.emit('shift:created', {});
        await _loadRoster(document.getElementById('main-content'));
      }},
    ],
  });
}

async function _rosterRequestShift() {
  Modal.open({
    title: 'Request a Shift',
    content: `
      <p class="text-muted text-sm mb-4">Your request will be reviewed by your coordinator.</p>
      <div class="form-group">
        <label class="form-label">Preferred Date</label>
        <input class="form-input" type="date" id="rs-date" min="${_iso(new Date())}">
      </div>
      <div class="grid-2">
        <div class="form-group"><label class="form-label">Start</label><input class="form-input" type="time" id="rs-start"></div>
        <div class="form-group"><label class="form-label">End</label><input class="form-input" type="time" id="rs-end"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-input" id="rs-notes" rows="2" placeholder="Any special requirements…"></textarea>
      </div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Send Request', style: 'primary', onClick: async () => {
        const user = State.get('user');
        let cp;
        try { cp = await API.clients.getByUser(user.id); } catch { Toast.error('Profile not found'); return; }
        await API.shifts.request({
          client_id:  cp.id,
          date:       document.getElementById('rs-date').value,
          start_time: document.getElementById('rs-start').value,
          end_time:   document.getElementById('rs-end').value,
          notes:      document.getElementById('rs-notes').value,
        });
        Modal.close();
        Toast.success('Request sent ✓');
      }},
    ],
  });
}

async function _rosterSetUnavailable() {
  Modal.open({
    title: 'Mark Unavailable',
    content: `
      <p class="text-muted text-sm mb-4">Block out dates you cannot work.</p>
      <div class="grid-2">
        <div class="form-group"><label class="form-label">From</label><input class="form-input" type="date" id="av-start" min="${_iso(new Date())}"></div>
        <div class="form-group"><label class="form-label">To</label><input class="form-input" type="date" id="av-end" min="${_iso(new Date())}"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason (optional)</label>
        <input class="form-input" type="text" id="av-reason" placeholder="e.g. Annual leave">
      </div>`,
    actions: [
      { label: 'Cancel', style: 'ghost', onClick: Modal.close },
      { label: 'Save',   style: 'primary', onClick: async () => {
        const user = State.get('user');
        let sp;
        try { sp = await API.staff.getByUser(user.id); } catch { Toast.error('Staff profile not found'); return; }
        const start  = document.getElementById('av-start').value;
        const end    = document.getElementById('av-end').value || start;
        const reason = document.getElementById('av-reason').value;
        if (!start) { Toast.error('Please select a date'); return; }
        await API.availability.create(sp.id, start, end, reason);
        Modal.close();
        Toast.success('Availability saved ✓');
      }},
    ],
  });
}

async function _openShiftDetail(shiftId) {
  // TODO: show full shift detail modal
  Toast.show('Shift detail — add your implementation here');
}

function _rosterCellClick(dateStr, clientId) {
  document.getElementById('ns-date').value   = dateStr;
  document.getElementById('ns-client').value = clientId;
}

// ── Date helpers ──────────────────────────────────────────
function _weekStart(offset = 0) {
  const d   = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function _iso(d) { return d instanceof Date ? d.toISOString().split('T')[0] : d; }
function _fmtShort(d) { return d.toLocaleDateString('en-AU', { day:'numeric', month:'short' }); }
function _fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m}${hr < 12 ? 'am' : 'pm'}`;
}
function _isToday(d) { return _iso(d) === _iso(new Date()); }
function _isPast(d) {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const t  = new Date();  t.setHours(0,0,0,0);
  return dt < t;
}
