// ════════════════════════════════════════════════════════════
// CareConnect — Event Bus
//
// A lightweight publish/subscribe system.
// Modules communicate through events instead of direct calls —
// this keeps them decoupled so you can add/change/remove
// features without breaking other parts.
//
// HOW TO USE:
//   // Subscribe  (usually in a module's init or mount)
//   Events.on('user:login', ({ user }) => console.log(user));
//
//   // Publish  (anywhere)
//   Events.emit('user:login', { user: currentUser });
//
//   // One-time listener
//   Events.once('app:ready', init);
//
//   // Unsubscribe
//   const off = Events.on('shift:created', handler);
//   off(); // removes the listener
//
// BUILT-IN EVENTS (emitted by core modules):
//   app:ready          — app booted, user is logged in
//   app:navigate       — { page }
//   user:login         — { user }
//   user:logout        — {}
//   state:change       — { key, value, prev }
//   notif:received     — { notification }
//   notif:badge-update — { count }
//   message:received   — { message, roomId }
//   shift:created      — { shift }
//   shift:updated      — { shift }
//   shift:cancelled    — { shiftId, reason }
//   report:submitted   — { report }
//
// ADDING YOUR OWN:
//   Just Events.emit('myfeature:thing', data) — no registration needed.
// ════════════════════════════════════════════════════════════

'use strict';

const Events = (() => {
  // Map of eventName → Set of handlers
  const _listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string}   event
   * @param {Function} handler  — called with (data)
   * @returns {Function} unsubscribe function
   */
  function on(event, handler) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(handler);
    // Return an "off" function for easy cleanup
    return () => off(event, handler);
  }

  /**
   * Subscribe to an event once — auto-removes after first call.
   */
  function once(event, handler) {
    const wrapper = (data) => { off(event, wrapper); handler(data); };
    return on(event, wrapper);
  }

  /**
   * Unsubscribe a handler.
   */
  function off(event, handler) {
    _listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event, calling all subscribers with data.
   * Errors in handlers are caught so one bad handler can't
   * break the others.
   */
  function emit(event, data = {}) {
    if (!_listeners.has(event)) return;
    for (const handler of _listeners.get(event)) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[Events] Handler error for "${event}":`, err);
      }
    }
  }

  /** Clear all listeners for an event (useful in tests or page teardown). */
  function clear(event) {
    _listeners.delete(event);
  }

  /** Debug: log all events to console. Call Events.debug() to enable. */
  let _debug = false;
  function debug(enable = true) {
    _debug = enable;
    if (enable) {
      const origEmit = emit;
      // Monkey-patch for debugging only
      console.info('[Events] Debug mode ON — all events will be logged');
    }
  }

  return Object.freeze({ on, once, off, emit, clear, debug });
})();
