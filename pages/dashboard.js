// ════════════════════════════════════════════════════════════
// CareConnect — Dashboard Page
//
// HOW TO EXTEND:
//   Add a new stat → renderStatCard(...)
//   Add a new alert → append to the alerts section
//   Add a new role view → add a case in render()
// ════════════════════════════════════════════════════════════

'use strict';

// ── Register with Router ──────────────────────────────────
Router.register('dashboard', {
  roles:   ['admin', 'staff', 'client'],
  render:  renderDashboard,
  cleanup: null,   // no timers or subscriptions to clean up
});

async function renderDashboard(container) {
  const user = State.get('user');
  const role = user.role;

  // Greeting
  container.innerHTML = `
    <div class="page-header">
      <h2>${_greeting()}, ${_firstName(user)}!</h2>
      <p>${new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
    </div>
    <div class="page-loading"><div class="spinner"></div></div>`;

  try {
    if (role === ROLES.ADMIN)  return await _adminDashboard(container, user);
    if (role === ROLES.STAFF)  return await _staffDashboard(container, user);
    if (role === ROLES.CLIENT) return await _clientDashboard(container, user);
  } catch (err) {
    container.innerHTML += `<div class="alert alert-error">${err.message}</div>`;
  }
}

/* ─── Admin ──────────────────────────────────────────────── */
async function _adminDashboard(container, user) {
  const [todayShifts, allStaff, allClients] = await Promise.all([
    API.shifts.getToday(),
    API.staff.getAll(),
    API.clients.getAll(),
  ]);

  const completed  = todayShifts.filter(s => s.status === SHIFT_STATUS.COMPLETED);
  const needReport = todayShifts.filter(s => s.status === SHIFT_STATUS.COMPLETED && !s.report_completed);
  const needInv    = todayShifts.filter(s => s.status === SHIFT_STATUS.COMPLETED && !s.invoice_sent);

  container.innerHTML = `
    <div class="page-header">
      <h2>${_greeting()}, ${_firstName(user)}!</h2>
      <p>${new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' })}</p>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      ${_statCard('📅', todayShifts.length, "Today's Shifts", 'var(--color-accent-xlt)',  'var(--color-accent-dark)')}
      ${_statCard('✓',  completed.length,   'Completed',      'var(--color-success-bg)',   'var(--color-success)')}
      ${_statCard('👥', allStaff.length,    'Total Staff',    'var(--color-primary-xlt)',  'var(--color-primary)')}
      ${_statCard('❤️', allClients.length,  'Total Clients',  'var(--color-info-bg)',      'var(--color-info)')}
    </div>

    <!-- Alerts -->
    ${needReport.length ? `
    <div class="alert alert-warning" style="cursor:pointer" onclick="Router.go('reports')">
      📋 <strong>${needReport.length} shift report${needReport.length > 1 ? 's' : ''}</strong> outstanding — tap to view →
    </div>` : ''}
    ${needInv.length ? `
    <div class="alert alert-warning">
      💰 <strong>${needInv.length} invoice${needInv.length > 1 ? 's' : ''}</strong> awaiting processing
    </div>` : ''}

    <!-- Today's shifts -->
    <div class="section-header">
      <span class="section-label">Today's Shifts</span>
      <button class="btn btn-ghost btn-sm" onclick="Router.go('roster')">View Roster →</button>
    </div>
    ${todayShifts.length === 0
      ? _emptyState('☀️', 'No shifts today')
      : todayShifts.map(s => _shiftCard(s, true)).join('')}

    <!-- Quick actions -->
    <div class="section-label mt-4 mb-3">Quick Actions</div>
    <div class="grid-2">
      <button class="btn btn-outline" onclick="Router.go('roster')">📅 Roster</button>
      <button class="btn btn-outline" onclick="Router.go('reports')">📋 Reports</button>
      <button class="btn btn-outline" onclick="Router.go('messaging')">💬 Messages</button>
      <button class="btn btn-outline" onclick="Router.go('clients')">👥 Clients</button>
    </div>`;
}

/* ─── Staff ──────────────────────────────────────────────── */
async function _staffDashboard(container, user) {
  let staffProfile;
  try { staffProfile = await API.staff.getByUser(user.id); } catch {}

  const today  = new Date().toISOString().split('T')[0];
  const shifts = staffProfile
    ? await API.shifts.getForStaff(staffProfile.id, today, today)
    : [];

  const upcoming   = shifts.filter(s => s.status === SHIFT_STATUS.SCHEDULED);
  const completed  = shifts.filter(s => s.status === SHIFT_STATUS.COMPLETED);
  const needReport = completed.filter(s => !s.report_completed);

  container.innerHTML = `
    <div class="page-header">
      <h2>${_greeting()}, ${_firstName(user)}!</h2>
      <p>${new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' })}</p>
    </div>

    <div class="stats-grid">
      ${_statCard('📅', shifts.length,        'My Shifts Today', 'var(--color-accent-xlt)', 'var(--color-accent-dark)')}
      ${_statCard('⏳', upcoming.length,      'Upcoming',        'var(--color-warning-bg)',  'var(--color-warning)')}
      ${_statCard('✓',  completed.length,     'Completed',       'var(--color-success-bg)',  'var(--color-success)')}
      ${_statCard('📋', needReport.length,    'Reports Due',     'var(--color-danger-bg)',   'var(--color-danger)')}
    </div>

    ${needReport.length ? `
    <div class="alert alert-warning" style="cursor:pointer" onclick="Router.go('reports')">
      ⚠️ ${needReport.length} shift report${needReport.length > 1 ? 's' : ''} outstanding — <strong>tap to complete →</strong>
    </div>` : `<div class="alert alert-success">✓ All reports up to date!</div>`}

    <div class="section-header">
      <span class="section-label">My Shifts Today</span>
      <button class="btn btn-ghost btn-sm" onclick="Router.go('roster')">Full Roster →</button>
    </div>

    ${shifts.length === 0
      ? _emptyState('🌟', 'No shifts today', 'Check the roster for upcoming shifts.')
      : shifts.map(s => _shiftCard(s, false)).join('')}`;
}

/* ─── Client ─────────────────────────────────────────────── */
async function _clientDashboard(container, user) {
  let clientProfile;
  try { clientProfile = await API.clients.getByUser(user.id); } catch {}

  const today  = new Date().toISOString().split('T')[0];
  const shifts = clientProfile
    ? await API.shifts.getForClient(clientProfile.id, today, today)
    : [];

  container.innerHTML = `
    <div class="page-header">
      <h2>${_greeting()}, ${_firstName(user)}!</h2>
      <p>${new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' })}</p>
    </div>

    <div class="section-label mb-3">Today's Support</div>

    ${shifts.length === 0 ? `
    <div class="card" style="text-align:center;padding:32px">
      <div style="font-size:2.5rem;margin-bottom:12px">😊</div>
      <h3 style="margin-bottom:8px">No support scheduled today</h3>
      <p class="text-muted text-sm">Check your schedule for upcoming visits.</p>
      <button class="btn btn-accent mt-4" onclick="Router.go('roster')">My Schedule</button>
    </div>` : shifts.map(s => _shiftCard(s, false)).join('')}

    <div class="section-label mt-4 mb-3">Quick Links</div>
    <div class="grid-2">
      <button class="btn btn-outline" onclick="Router.go('roster')">📅 My Schedule</button>
      <button class="btn btn-outline" onclick="Router.go('reports')">📋 My Info</button>
      <button class="btn btn-outline" onclick="Router.go('messaging')">💬 Messages</button>
      <button class="btn btn-outline" onclick="Router.go('account')">👤 Account</button>
    </div>`;
}

/* ─── Shared helpers ─────────────────────────────────────── */
function _statCard(icon, value, label, bgColor, textColor) {
  return `<div class="stat-card">
    <div class="stat-icon" style="background:${bgColor}">${icon}</div>
    <div class="stat-value" style="color:${textColor}">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function _shiftCard(shift, showClient = true) {
  const clientUser = shift.expand?.['client_id.user_id'];
  const staffList  = shift.expand?.staff_ids ?? [];
  const statusCss  = { completed: 'chip-success', cancelled: 'chip-danger', pending: 'chip-warning', scheduled: 'chip-accent' }[shift.status] ?? 'chip-grey';

  return `<div class="shift-card ${shift.status}" onclick="">
    <div class="shift-card-top">
      <div>
        <div class="shift-time">${_fmtTime(shift.start_time)} – ${_fmtTime(shift.end_time)}</div>
        ${showClient && clientUser ? `<div class="shift-subtitle">👤 ${clientUser.name || clientUser.email}</div>` : ''}
      </div>
      <span class="chip ${statusCss}">${shift.status}</span>
    </div>
    <div class="shift-staff-chips">
      ${staffList.length
        ? staffList.map(s => `<span class="staff-chip">${s.name || s.email}</span>`).join('')
        : '<span class="staff-chip" style="background:var(--color-warning-bg);color:#92400e">Staff TBC</span>'}
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;font-size:0.72rem;color:var(--color-text-muted)">
      <span>${shift.report_completed  ? '✓ Report' : '⬜ Report'}</span>
      <span>${shift.invoice_sent      ? '✓ Invoice': '⬜ Invoice'}</span>
      <span>${shift.wages_paid        ? '✓ Wages'  : '⬜ Wages'}</span>
    </div>
  </div>`;
}

function _emptyState(icon, title, sub = '') {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <h3>${title}</h3>
    ${sub ? `<p>${sub}</p>` : ''}
  </div>`;
}

function _greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function _firstName(user) { return (user.name || user.email).split(' ')[0]; }
function _fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`;
}
