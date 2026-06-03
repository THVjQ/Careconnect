// ════════════════════════════════════════════════════════════
// CareConnect — State Store
//
// A simple reactive state store. All app-wide data lives here.
// Components read from State and react to 'state:change' events
// instead of passing data around via function arguments.
//
// HOW TO USE:
//   // Read
//   const user = State.get('user');
//
//   // Write  (emits 'state:change' + 'state:change:user')
//   State.set('user', { id: '...', name: 'Alice', role: 'staff' });
//
//   // React to a specific key changing
//   Events.on('state:change:user', ({ value }) => updateUI(value));
//
//   // React to any state change
//   Events.on('state:change', ({ key, value, prev }) => { ... });
//
// INITIAL SHAPE — add new keys here so they're self-documenting.
// ════════════════════════════════════════════════════════════

'use strict';

const State = (() => {
  // ── Initial state shape ──────────────────────────────────
  // Extend this as you add features.
  const _state = {
    // Auth
    user:         null,   // PocketBase auth model  { id, email, name, role, avatar }
    isLoggedIn:   false,

    // Navigation
    currentPage:  'dashboard',

    // Cached data (optional — keeps data between page visits)
    allStaff:     null,   // null = not yet loaded
    allClients:   null,

    // Notification badge
    unreadNotifs: 0,

    // Messaging
    activeRoomId: null,

    // Settings (persisted to localStorage)
    settings: _loadSettings(),
  };

  // ── Getters ──────────────────────────────────────────────
  function get(key) {
    return _state[key];
  }

  function getAll() {
    return { ..._state };
  }

  // ── Setters ──────────────────────────────────────────────
  function set(key, value) {
    const prev = _state[key];
    _state[key] = value;

    // Emit generic + key-specific events
    Events.emit('state:change',        { key, value, prev });
    Events.emit(`state:change:${key}`, { value, prev });
  }

  /** Merge a partial object into an existing object value */
  function merge(key, partial) {
    const current = _state[key] ?? {};
    set(key, { ...current, ...partial });
  }

  // ── Settings (auto-persisted to localStorage) ─────────────
  function getSetting(key, defaultValue = null) {
    const s = _state.settings;
    return s[key] !== undefined ? s[key] : defaultValue;
  }

  function setSetting(key, value) {
    merge('settings', { [key]: value });
    _persistSettings(_state.settings);
  }

  function _loadSettings() {
    try {
      return JSON.parse(localStorage.getItem('cc_settings') || '{}');
    } catch { return {}; }
  }

  function _persistSettings(settings) {
    try {
      localStorage.setItem('cc_settings', JSON.stringify(settings));
    } catch {}
  }

  // ── Reset (on logout) ─────────────────────────────────────
  function reset() {
    set('user',         null);
    set('isLoggedIn',   false);
    set('currentPage',  'dashboard');
    set('allStaff',     null);
    set('allClients',   null);
    set('unreadNotifs', 0);
    set('activeRoomId', null);
  }

  return Object.freeze({ get, getAll, set, merge, getSetting, setSetting, reset });
})();
