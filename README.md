# CareConnect

A mobile-first Progressive Web App (PWA) for disability support and care coordination. Built with vanilla JavaScript and [PocketBase](https://pocketbase.io/) — no build step required.

## Features

- Role-based access for **Admin**, **Staff**, and **Client**
- Dashboard, Roster, Reports, and Messaging pages
- Real-time notifications via PocketBase subscriptions
- WebAuthn biometric login (Face ID / Fingerprint)
- Offline support via Service Worker
- Hash-based SPA routing with role guards
- Bug reporting via EmailJS

## Project Structure

```
careconnect-base/
├── core/
│   ├── config.js      # App constants, nav definition, icons
│   ├── events.js      # Pub/sub event bus
│   ├── state.js       # Reactive key/value store
│   ├── api.js         # All PocketBase API calls
│   ├── auth.js        # Login, logout, biometrics, session restore
│   ├── router.js      # Hash-based SPA router
│   └── app.js         # Bootstrap entry point
├── components/
│   ├── nav.js         # Sidebar + bottom nav
│   ├── modal.js       # Modal dialog
│   ├── toast.js       # Toast notifications
│   └── bugReport.js   # Bug report form
├── pages/
│   ├── dashboard.js
│   ├── roster.js
│   └── reports.js
├── css/
│   ├── base.css       # Reset + CSS variables
│   └── components.css # UI component styles
├── sw.js              # Service worker
└── index.html
```

## Setup

### 1. Configure the app

Edit `core/config.js` and fill in your credentials:

```js
PB_URL:             'https://your-pocketbase-url.com',
EMAILJS_PUBLIC_KEY: 'YOUR_EMAILJS_PUBLIC_KEY',
EMAILJS_SERVICE_ID: 'YOUR_EMAILJS_SERVICE_ID',
EMAILJS_TEMPLATE:   'YOUR_EMAILJS_TEMPLATE_ID',
ADMIN_EMAIL:        'admin@example.com',
VAPID_KEY:          'YOUR_VAPID_PUBLIC_KEY',
```

### 2. Set up PocketBase

Create the following collections in your PocketBase instance:

| Collection | Purpose |
|---|---|
| `users` | Built-in PocketBase auth collection |
| `staff` | Staff profiles (linked to users) |
| `clients` | Client profiles (linked to users) |
| `shifts` | Scheduled shifts |
| `shift_reports` | Shift notes and goal tracking (immutable once submitted) |
| `goals` | Client goals |
| `incidents` | Incident reports |
| `messages` | Chat messages |
| `chat_rooms` | Chat rooms / channels |
| `availability` | Staff unavailable date blocks |
| `notifications` | In-app notification log |
| `push_subs` | Web Push subscriptions |

Each user record should have a `role` field with one of: `admin`, `staff`, `client`.

### 3. Run locally

The service worker requires a proper web server (not `file://`):

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Roles

| Role | Access |
|---|---|
| `admin` | Dashboard, Roster, Reports, Messages, Clients, Settings |
| `staff` | Dashboard, Roster, Reports, Messages, Account |
| `client` | Dashboard, Roster, Reports, Messages, Account |

## Extending the App

**Add a new page:**
1. Create `pages/my-page.js` and call `Router.register('my-page', { render, cleanup })`
2. Add an entry to `NAV_ITEMS` in `core/config.js`
3. Add `<script src="pages/my-page.js"></script>` to `index.html` before `core/app.js`

**Add a new API resource:**
Follow the pattern in `core/api.js` — add a new object with `get`, `getAll`, `create`, `update`, `delete` methods and expose it on the `API` return value.

**Add a new role:**
Add the role string to `ROLES` in `core/config.js` and update `NAV_ITEMS` entries accordingly.

## License

[MIT](LICENSE) — Copyright (c) 2026 Luca Reifler
