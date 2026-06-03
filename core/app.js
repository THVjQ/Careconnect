// ════════════════════════════════════════════════════════════
// CareConnect — App Bootstrap
//
// This is the entry point. It:
//   1. Initialises the database (PocketBase)
//   2. Tries to restore an existing session
//   3. Wires up global event listeners
//   4. On login: builds nav, subscribes to real-time, starts router
//
// Everything else is handled by its own module.
// To add a new global behaviour: add a listener under "Global event wiring".
// ════════════════════════════════════════════════════════════

'use strict';

/* ── DOMContentLoaded — runs once when HTML is parsed ─────── */
document.addEventListener('DOMContentLoaded', async () => {

  // 1. Init PocketBase
  API.init(APP.PB_URL);

  // 2. Init EmailJS (bug reports)
  if (typeof emailjs !== 'undefined') {
    emailjs.init(APP.EMAILJS_PUBLIC_KEY);
  }

  // 3. Bind login screen UI
  Auth.init();
  BugReport.init();

  // 4. Wire sidebar / logout buttons (bound once, always present)
  _bindShellButtons();

  // 5. Wire global event listeners
  _wireEvents();

  // 6. Try to restore an existing session
  const restored = await Auth.tryRestoreSession();
  if (restored) {
    await _bootApp(API.auth.model());
  }
  // If not restored, login screen stays visible (default state in HTML)
});

/* ── Boot after successful login ─────────────────────────── */
async function _bootApp(user) {
  State.set('user',       user);
  State.set('isLoggedIn', true);

  // Build nav for this role
  Nav.build(user.role);
  Nav.updateUserInfo(user);

  // Register service worker
  await _registerSW();

  // Subscribe to real-time notifications
  API.notifications.subscribeForUser(user.id, (notif) => {
    Events.emit('notif:received', { notification: notif });
  });

  // Set initial badge count
  await _refreshNotifBadge();

  // Start router (reads #hash or defaults to dashboard)
  Router.start();
}

/* ── Shell button bindings (sidebar, logout, etc.) ────────── */
function _bindShellButtons() {
  _on('btn-sidebar-toggle', 'click', Nav.openSidebar);
  _on('btn-sidebar-close',  'click', Nav.closeSidebar);
  _on('sidebar-overlay',    'click', Nav.closeSidebar);
  _on('btn-logout',         'click', () => Auth.logout());
  _on('btn-notifications',  'click', () => Router.go('notifications'));
  _on('btn-user-avatar',    'click', () => Router.go('account'));
  _on('btn-bug-login',      'click', BugReport.show);
  _on('btn-bug-sidebar',    'click', BugReport.show);
}

/* ── Global event wiring ──────────────────────────────────── */
function _wireEvents() {

  // After login: boot the app
  Events.on('user:login', async ({ user }) => {
    await _bootApp(user);
  });

  // After logout: nothing extra needed (Auth handles screen switch)
  Events.on('user:logout', () => {
    Nav.closeSidebar();
  });

  // Biometric registered → show toast
  Events.on('auth:biometric-registered', () => {
    Toast.show('Biometric login enabled ✓', 'success');
  });

  // New notification received
  Events.on('notif:received', ({ notification }) => {
    _refreshNotifBadge();
    Toast.show(`🔔 ${notification.title} — ${notification.body}`);

    // Show system notification if app is in background
    if (document.hidden && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(notification.title, {
          body:  notification.body,
          icon:  '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          data:  { url: notification.url || '/' },
        });
      });
    }
  });

  // Shift events → invalidate cached data so next load is fresh
  Events.on('shift:created',   () => { State.set('allStaff', null); });
  Events.on('shift:cancelled', () => { State.set('allStaff', null); });

  // State: user updated (e.g. name change) → refresh nav UI
  Events.on('state:change:user', ({ value }) => {
    if (value) Nav.updateUserInfo(value);
  });
}

/* ── Service Worker ──────────────────────────────────────── */
async function _registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('[App] SW registered:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('[App] SW registration failed:', err);
    return null;
  }
}

/* ── Notification badge ───────────────────────────────────── */
async function _refreshNotifBadge() {
  const user = State.get('user');
  if (!user) return;
  try {
    const result = await API.notifications.getForUser(user.id, true);
    const count  = result.totalItems ?? 0;
    State.set('unreadNotifs', count);

    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

/* ── Tiny helper ─────────────────────────────────────────── */
function _on(id, event, handler) {
  document.getElementById(id)?.addEventListener(event, handler);
}
