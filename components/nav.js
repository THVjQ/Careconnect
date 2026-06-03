// ════════════════════════════════════════════════════════════
// CareConnect — Nav Component
//
// Builds sidebar + bottom nav from NAV_ITEMS in config.js.
// Adding a page to NAV_ITEMS automatically adds it to navigation.
//
// Public API:
//   Nav.build(role)          — call once on login
//   Nav.updateUserInfo(user) — call when user profile changes
//   Nav.openSidebar()
//   Nav.closeSidebar()
//   Nav.setActive(pageId)    — called by Router automatically
// ════════════════════════════════════════════════════════════

'use strict';

const Nav = (() => {

  // ── Build nav for a given role ────────────────────────────
  function build(role) {
    _buildSidebar(role);
    _buildBottomNav(role);
  }

  function _buildSidebar(role) {
    const items   = NAV_ITEMS.filter(n => !n.roles || n.roles.includes(role));
    const sideNav = document.getElementById('sidebar-nav');
    if (!sideNav) return;

    sideNav.innerHTML = items.map(item => `
      <li>
        <button class="sidebar-nav-btn"
                data-page="${item.id}"
                onclick="Router.go('${item.id}')"
                aria-label="Navigate to ${item.label}">
          ${ICONS[item.icon] ?? ''}
          <span>${item.label}</span>
        </button>
      </li>
    `).join('');
  }

  function _buildBottomNav(role) {
    const items    = NAV_ITEMS.filter(n => n.bottom && (!n.roles || n.roles.includes(role)));
    const bottomEl = document.getElementById('bottom-nav');
    if (!bottomEl) return;

    bottomEl.innerHTML = items.map(item => `
      <button class="bottom-nav-btn"
              data-page="${item.id}"
              onclick="Router.go('${item.id}')"
              aria-label="${item.label}">
        ${ICONS[item.icon] ?? ''}
        <span>${item.label}</span>
      </button>
    `).join('');
  }

  // ── Update user info in sidebar ───────────────────────────
  function updateUserInfo(user) {
    if (!user) return;
    const initials = _initials(user.name || user.email);
    const color    = _roleColor(user.role);

    // Topbar avatar
    const topbarInitials = document.getElementById('user-initials');
    const topbarAvatar   = document.getElementById('btn-user-avatar');
    if (topbarInitials) topbarInitials.textContent = initials;
    if (topbarAvatar)   topbarAvatar.style.background = color;

    // Sidebar
    const sideInitials = document.getElementById('sidebar-initials');
    const sideName     = document.getElementById('sidebar-name');
    const sideBadge    = document.getElementById('sidebar-role-badge');
    const sideAvatar   = document.getElementById('sidebar-avatar');

    if (sideInitials) sideInitials.textContent = initials;
    if (sideName)     sideName.textContent     = user.name || user.email;
    if (sideBadge)  { sideBadge.textContent = user.role; sideBadge.className = `role-badge ${user.role}`; }
    if (sideAvatar)   sideAvatar.style.background = color;

    // If user has an avatar image, render it
    const avatarUrl = API.users.getAvatarUrl(user, 48);
    if (avatarUrl && sideAvatar) {
      sideAvatar.innerHTML = `<img src="${avatarUrl}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }
  }

  // ── Sidebar open / close ──────────────────────────────────
  function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle  = document.getElementById('btn-sidebar-toggle');
    sidebar?.classList.add('open');
    overlay?.classList.remove('hidden');
    toggle?.setAttribute('aria-expanded', 'true');
    // Trap focus inside sidebar
    setTimeout(() => sidebar?.querySelector('button')?.focus(), 50);
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle  = document.getElementById('btn-sidebar-toggle');
    sidebar?.classList.remove('open');
    overlay?.classList.add('hidden');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  // ── Helpers ───────────────────────────────────────────────
  function _initials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  function _roleColor(role) {
    return {
      admin:  'var(--color-role-admin)',
      staff:  'var(--color-role-staff)',
      client: 'var(--color-role-client)',
    }[role] ?? 'var(--color-primary)';
  }

  // Listen to Router navigation events to keep active state in sync
  Events.on('app:navigate', ({ page }) => {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) closeSidebar();
  });

  return Object.freeze({ build, updateUserInfo, openSidebar, closeSidebar });
})();
