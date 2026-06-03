// ════════════════════════════════════════════════════════════
// CareConnect — Configuration
//
// HOW TO EXTEND:
//   • Add new collections → COLLECTIONS
//   • Add new roles       → ROLES
//   • Add new pages       → NAV_ITEMS (auto-populates nav)
//   • Change colours      → set CSS vars at runtime (see Settings page)
// ════════════════════════════════════════════════════════════

'use strict';

/* ─── App ────────────────────────────────────────────────── */
const APP = Object.freeze({
  NAME:    'CareConnect',
  VERSION: '1.0.0',

  // ⚠️  SET THESE BEFORE DEPLOYING
  PB_URL:             'https://YOUR-POCKETBASE-URL.com',
  EMAILJS_PUBLIC_KEY: 'YOUR_EMAILJS_PUBLIC_KEY',
  EMAILJS_SERVICE_ID: 'YOUR_EMAILJS_SERVICE_ID',
  EMAILJS_TEMPLATE:   'YOUR_EMAILJS_TEMPLATE_ID',
  ADMIN_EMAIL:        'admin@example.com',
  VAPID_KEY:          'YOUR_VAPID_PUBLIC_KEY',
});

/* ─── PocketBase collection names ────────────────────────── */
// Keeps magic strings in one place.
// If you rename a collection in PocketBase, update it here only.
const COLLECTIONS = Object.freeze({
  USERS:         'users',         // built-in PocketBase auth collection
  STAFF:         'staff',         // staff profiles (linked to users)
  CLIENTS:       'clients',       // client profiles (linked to users)
  SHIFTS:        'shifts',        // scheduled shifts
  SHIFT_REPORTS: 'shift_reports', // shift notes & goal tracking (immutable once submitted)
  GOALS:         'goals',         // client goals
  INCIDENTS:     'incidents',     // incident reports
  MESSAGES:      'messages',      // chat messages
  ROOMS:         'chat_rooms',    // chat rooms / channels
  AVAILABILITY:  'availability',  // staff unavailable date blocks
  NOTIFICATIONS: 'notifications', // in-app notification log
  PUSH_SUBS:     'push_subs',     // Web Push subscriptions
});

/* ─── Roles ──────────────────────────────────────────────── */
// Must match the `role` values stored in PocketBase users collection.
const ROLES = Object.freeze({
  ADMIN:  'admin',
  STAFF:  'staff',
  CLIENT: 'client',
});

/* ─── Shift Statuses ─────────────────────────────────────── */
const SHIFT_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PENDING:   'pending',    // client-requested, awaiting admin approval
});

/* ─── Navigation Definition ──────────────────────────────── */
// Add a new page here → it automatically appears in sidebar + bottom nav.
//
// Each entry:
//   id      — matches Router page id and #hash
//   label   — display name
//   icon    — key into ICONS map below
//   roles   — which roles can see this item (omit = all roles)
//   bottom  — include in mobile bottom nav (max 5)

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard', icon: 'grid',     roles: ['admin','staff','client'], bottom: true },
  { id: 'roster',     label: 'Roster',    icon: 'calendar', roles: ['admin','staff','client'], bottom: true },
  { id: 'reports',    label: 'Reports',   icon: 'file',     roles: ['admin','staff','client'], bottom: true },
  { id: 'messaging',  label: 'Messages',  icon: 'chat',     roles: ['admin','staff','client'], bottom: true },
  { id: 'clients',    label: 'Clients',   icon: 'users',    roles: ['admin'],                  bottom: false },
  { id: 'settings',   label: 'Settings',  icon: 'settings', roles: ['admin'],                  bottom: true },
  { id: 'account',    label: 'Account',   icon: 'user',     roles: ['staff','client'],          bottom: true },
];

/* ─── SVG Icons ──────────────────────────────────────────── */
// Centralised icon map. Add more as needed.
// Usage: ICONS.grid  or  ICONS['grid']
const ICONS = Object.freeze({
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`,
  add:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
});
