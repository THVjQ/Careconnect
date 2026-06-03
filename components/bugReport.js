// ════════════════════════════════════════════════════════════
// CareConnect — Bug Report Component
// EmailJS → admin email
// ════════════════════════════════════════════════════════════

'use strict';

const BugReport = (() => {

  function init() {
    // Nothing to bind at startup — modal is generated on show()
  }

  function show() {
    const user = State.get('user');

    Modal.open({
      title: '🐛 Report a Problem',
      content: `
        <div id="bug-alert"></div>
        <div class="form-group">
          <label class="form-label">Your Name</label>
          <input class="form-input" id="bug-name" value="${user?.name ?? ''}" placeholder="Your name">
        </div>
        <div class="form-group">
          <label class="form-label">Your Email</label>
          <input class="form-input" id="bug-email" type="email" value="${user?.email ?? ''}" placeholder="your@email.com">
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-input" id="bug-type">
            <option value="bug">🐛 Bug / Error</option>
            <option value="feature">💡 Feature Request</option>
            <option value="other">📝 Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-input" id="bug-desc" rows="4"
                    placeholder="Please describe the issue in detail…"></textarea>
        </div>`,
      actions: [
        { label: 'Cancel', style: 'ghost', onClick: Modal.close },
        { label: 'Send Report', style: 'primary', onClick: _submit },
      ],
    });
  }

  async function _submit(btn) {
    const name  = document.getElementById('bug-name')?.value.trim();
    const email = document.getElementById('bug-email')?.value.trim();
    const type  = document.getElementById('bug-type')?.value;
    const desc  = document.getElementById('bug-desc')?.value.trim();
    const alert = document.getElementById('bug-alert');

    if (!desc) {
      if (alert) { alert.className = 'alert alert-error'; alert.textContent = 'Please describe the issue.'; }
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await emailjs.send(
        APP.EMAILJS_SERVICE_ID,
        APP.EMAILJS_TEMPLATE,
        {
          from_name:   name  || 'Anonymous',
          from_email:  email || 'unknown',
          report_type: type,
          description: desc,
          app_version: APP.VERSION,
          timestamp:   new Date().toLocaleString('en-AU'),
          user_agent:  navigator.userAgent,
          to_email:    APP.ADMIN_EMAIL,
        }
      );
      Modal.close();
      Toast.success('Report sent! We\'ll look into it shortly.');
    } catch (err) {
      console.error('[BugReport]', err);
      if (alert) { alert.className = 'alert alert-error'; alert.textContent = 'Failed to send — please try again.'; }
      btn.disabled = false;
      btn.textContent = 'Send Report';
    }
  }

  return Object.freeze({ init, show });
})();
