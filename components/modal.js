// ════════════════════════════════════════════════════════════
// CareConnect — Modal Component
//
// Programmatic modal: no inline HTML needed in pages.
//
// Usage:
//   // Simple confirm
//   const ok = await Modal.confirm('Delete this shift?', 'This cannot be undone.');
//
//   // Custom content
//   Modal.open({
//     title:   'Add Shift',
//     content: '<div class="form-group">...</div>',
//     actions: [
//       { label: 'Cancel', style: 'ghost', onClick: Modal.close },
//       { label: 'Save',   style: 'primary', onClick: () => save() },
//     ],
//   });
//
//   // Close from anywhere
//   Modal.close();
// ════════════════════════════════════════════════════════════

'use strict';

const Modal = (() => {
  const ROOT = () => document.getElementById('modal-root');

  let _resolveConfirm = null; // for Modal.confirm()

  /**
   * Open a modal with given options.
   * @param {object} opts
   *   @param {string}   opts.title
   *   @param {string}   opts.content   — HTML string for the body
   *   @param {Array}    [opts.actions] — buttons: { label, style, onClick }
   *   @param {boolean}  [opts.closeOnBackdrop=true]
   *   @param {string}   [opts.size]    — 'sm' | 'md' (default) | 'lg'
   */
  function open({ title, content, actions = [], closeOnBackdrop = true, size = 'md' } = {}) {
    close(); // Close any existing modal

    const actionsHtml = actions.map((a, i) =>
      `<button class="btn btn-${a.style || 'ghost'}" data-modal-action="${i}">${a.label}</button>`
    ).join('');

    const maxW = { sm: '380px', md: '520px', lg: '680px' }[size] ?? '520px';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'false');
    backdrop.innerHTML = `
      <div class="modal-box" style="max-width:${maxW}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="icon-btn" id="modal-close-btn" aria-label="Close dialog">
            ${ICONS.x}
          </button>
        </div>
        <div class="modal-body" id="modal-body">${content}</div>
        ${actionsHtml ? `<div class="modal-footer">${actionsHtml}</div>` : ''}
      </div>`;

    // Close on backdrop click
    if (closeOnBackdrop) {
      backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    }

    // Close button
    backdrop.querySelector('#modal-close-btn').addEventListener('click', () => {
      close();
      if (_resolveConfirm) { _resolveConfirm(false); _resolveConfirm = null; }
    });

    // Action button callbacks
    actions.forEach((action, i) => {
      const btn = backdrop.querySelector(`[data-modal-action="${i}"]`);
      if (btn && action.onClick) {
        btn.addEventListener('click', () => action.onClick(btn));
      }
    });

    // Close on Escape
    document.addEventListener('keydown', _onEscape);

    ROOT().innerHTML = '';
    ROOT().appendChild(backdrop);
    ROOT().setAttribute('aria-hidden', 'false');

    // Focus first focusable element
    setTimeout(() => backdrop.querySelector('button, input, select, textarea')?.focus(), 50);
  }

  /** Close the currently open modal. */
  function close() {
    const backdrop = ROOT().querySelector('.modal-backdrop');
    if (!backdrop) return;
    backdrop.style.animation = 'fade-in 0.18s ease reverse';
    setTimeout(() => {
      ROOT().innerHTML = '';
      ROOT().setAttribute('aria-hidden', 'true');
    }, 200);
    document.removeEventListener('keydown', _onEscape);
  }

  /**
   * Show a confirm dialog. Returns a Promise<boolean>.
   *
   * @example
   *   if (await Modal.confirm('Delete shift?', 'This cannot be undone.')) {
   *     await API.shifts.cancel(id, reason);
   *   }
   */
  function confirm(title, message = '', confirmLabel = 'Confirm', dangerConfirm = false) {
    return new Promise(resolve => {
      _resolveConfirm = resolve;
      open({
        title,
        content: message ? `<p style="color:var(--color-text-muted)">${message}</p>` : '',
        actions: [
          {
            label: 'Cancel',
            style: 'ghost',
            onClick: () => { close(); resolve(false); _resolveConfirm = null; },
          },
          {
            label:   confirmLabel,
            style:   dangerConfirm ? 'danger' : 'primary',
            onClick: () => { close(); resolve(true);  _resolveConfirm = null; },
          },
        ],
        closeOnBackdrop: false,
      });
    });
  }

  /**
   * Get the modal body element (so pages can update content inside an open modal).
   */
  function body() { return document.getElementById('modal-body'); }

  function _onEscape(e) {
    if (e.key === 'Escape') {
      close();
      if (_resolveConfirm) { _resolveConfirm(false); _resolveConfirm = null; }
    }
  }

  return Object.freeze({ open, close, confirm, body });
})();
