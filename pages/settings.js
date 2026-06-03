// ════════════════════════════════════════════════════════════
// CareConnect — Settings Page
// Also registers: Notifications page, Clients list page
// ════════════════════════════════════════════════════════════

'use strict';

// ── Settings ──────────────────────────────────────────────
Router.register('settings', {
  roles: ['admin'],
  render: renderSettings,
});

async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Settings</h2></div>

    <div class="section-label mb-3">🔔 Notifications</div>
    <div class="card mb-4">
      ${_settingToggle('Shift Reminders',        'pref_shift_remind',  true,  'Remind before shift starts')}
      ${_settingToggle('Report Due Reminders',   'pref_report_remind', true,  'Remind staff to complete reports')}
      ${_settingToggle('New Messages',           'pref_msg_notif',     true,  'Alerts for new chat messages')}
      ${_settingToggle('Auto Post-Shift Remind', 'admin_post_shift',   true,  'Auto-notify staff after each shift (admin)')}
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

function _settingToggle(label, key, defaultVal, sub) {
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

// ── Notifications page ────────────────────────────────────
Router.register('notifications', {
  roles: ['admin', 'staff', 'client'],
  render: renderNotifications,
});

async function renderNotifications(container) {
  const user = State.get('user');
  const { items } = await API.notifications.getForUser(user.id);
  await API.notifications.markAllRead(user.id);
  State.set('unreadNotifs', 0);
  document.getElementById('notif-badge')?.classList.add('hidden');

  container.innerHTML = `
    <div class="page-header"><h2>Notifications</h2></div>
    ${items.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon">🔔</div><h3>All caught up!</h3></div>'
      : `<div class="card">
          ${items.map(n => `
            <div class="list-item" style="${!n.read ? 'background:var(--color-primary-xlt);margin:0 -20px;padding:12px 20px;border-radius:var(--radius-sm)' : ''}">
              <div style="font-size:1.2rem">${n.read ? '📩' : '🔔'}</div>
              <div style="flex:1">
                <div class="list-item-label">${n.title}</div>
                <div class="list-item-sub">${n.body}</div>
                <div style="font-size:0.7rem;color:var(--color-text-light);margin-top:2px">${_settingsRelTime(n.created)}</div>
              </div>
            </div>`).join('')}
        </div>`}`;
}

// ── Clients list page ─────────────────────────────────────
Router.register('clients', {
  roles: ['admin'],
  render: renderClients,
});

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

// ── Shared helper ─────────────────────────────────────────
function _settingsRelTime(str) {
  if (!str) return '';
  const m = Math.floor((Date.now() - new Date(str)) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
