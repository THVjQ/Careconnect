// ════════════════════════════════════════════════════════════
// CareConnect — Router
//
// Hash-based SPA router with:
//   • Role-based guards (redirect if not allowed)
//   • Page lifecycle hooks (mount → render → cleanup)
//   • Middleware support (e.g. analytics, scroll-to-top)
//
// HOW TO REGISTER A PAGE:
//   Router.register('my-page', {
//     roles:   ['admin', 'staff'],     // who can view (omit = everyone)
//     render:  async (container) => { container.innerHTML = '...'; },
//     cleanup: () => { /* stop timers, unsubscribe, etc. */ },
//   });
//
// HOW TO NAVIGATE:
//   Router.go('dashboard');
//   Router.go('roster');
// ════════════════════════════════════════════════════════════

'use strict';

const Router = (() => {

  const _pages    = new Map();   // id → { roles, render, cleanup }
  let   _current  = null;        // currently active page id
  let   _cleanup  = null;        // cleanup fn for current page

  // ── Register a page ───────────────────────────────────────
  /**
   * @param {string} id      — matches #hash in URL
   * @param {object} page
   *   @param {string[]} [page.roles]   — allowed roles (omit = all)
   *   @param {Function}  page.render   — async (container: HTMLElement) => void
   *   @param {Function} [page.cleanup] — called when navigating away
   */
  function register(id, page) {
    _pages.set(id, page);
  }

  // ── Navigate ──────────────────────────────────────────────
  async function go(pageId, pushHistory = true) {
    const user = State.get('user');

    // 1. Resolve page
    const page = _pages.get(pageId);
    if (!page) {
      console.warn(`[Router] Unknown page: "${pageId}"`);
      go('dashboard', false);
      return;
    }

    // 2. Role guard
    if (page.roles && user) {
      if (!page.roles.includes(user.role)) {
        console.warn(`[Router] Access denied to "${pageId}" for role "${user.role}"`);
        go('dashboard', false);
        return;
      }
    }

    // 3. Run cleanup for current page
    if (_cleanup) {
      try { _cleanup(); } catch (e) { console.warn('[Router] Cleanup error:', e); }
      _cleanup = null;
    }

    // 4. Update state + URL
    _current = pageId;
    State.set('currentPage', pageId);
    if (pushHistory) history.pushState({ page: pageId }, '', `#${pageId}`);

    // 5. Update topbar title
    const navItem = NAV_ITEMS.find(n => n.id === pageId);
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = navItem?.label ?? pageId;

    // 6. Update nav active states
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });

    // 7. Show loading, render page
    const container = document.getElementById('main-content');
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';

    try {
      await page.render(container);
      _cleanup = page.cleanup ?? null;

      // Scroll to top
      container.scrollTop = 0;

      Events.emit('app:navigate', { page: pageId });

    } catch (err) {
      console.error(`[Router] Render error for "${pageId}":`, err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>${err.message || 'Failed to load this page.'}</p>
          <button class="btn btn-outline mt-4" onclick="Router.go('dashboard')">Go to Dashboard</button>
        </div>`;
    }
  }

  // ── Handle browser back/forward ───────────────────────────
  function _initPopState() {
    window.addEventListener('popstate', (e) => {
      const id = e.state?.page ?? location.hash.replace('#', '') ?? 'dashboard';
      go(id, false);
    });
  }

  // ── Bootstrap: read initial hash ─────────────────────────
  function start() {
    _initPopState();
    const initial = location.hash.replace('#', '') || 'dashboard';
    go(initial, false);
  }

  function currentPage() { return _current; }

  return Object.freeze({ register, go, start, currentPage });
})();
