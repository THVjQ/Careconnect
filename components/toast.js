// ════════════════════════════════════════════════════════════
// CareConnect — Toast Component
//
// Usage:
//   Toast.show('Saved!');
//   Toast.show('Error occurred', 'error');
//   Toast.show('Heads up', 'warning', 5000);
//   Toast.show('Info', 'info');
//   Toast.success('Done!');
//   Toast.error('Something failed');
// ════════════════════════════════════════════════════════════

'use strict';

const Toast = (() => {
  const ROOT = () => document.getElementById('toast-root');

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'|''} type
   * @param {number} duration  ms before auto-dismiss (0 = manual)
   */
  function show(message, type = '', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.textContent = message;
    toast.setAttribute('role', 'status');

    // Tap to dismiss early
    toast.addEventListener('click', () => _dismiss(toast));

    ROOT().appendChild(toast);

    if (duration > 0) {
      setTimeout(() => _dismiss(toast), duration);
    }

    return toast; // Caller can dismiss manually if needed
  }

  function _dismiss(toast) {
    if (!toast.isConnected) return;
    toast.style.animation = 'toast-out 0.25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }

  // Convenience aliases
  const success = (msg, ms) => show(msg, 'success', ms);
  const error   = (msg, ms) => show(msg, 'error',   ms ?? 5000);
  const warning = (msg, ms) => show(msg, 'warning', ms);
  const info    = (msg, ms) => show(msg, 'info',    ms);

  return Object.freeze({ show, success, error, warning, info });
})();
