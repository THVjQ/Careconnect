// ════════════════════════════════════════════════════════════
// CareConnect — Account Page
// ════════════════════════════════════════════════════════════

'use strict';

Router.register('account', {
  roles: ['admin', 'staff', 'client'],
  render: renderAccount,
});

async function renderAccount(container) {
  const user = State.get('user');

  container.innerHTML = `
    <div class="profile-header">
      <div style="position:relative;display:inline-block">
        <div class="avatar avatar-lg" id="acct-avatar" style="margin:0 auto;background:var(--color-role-${user.role})">
          ${_acctInitials(user.name || user.email)}
        </div>
        <button onclick="_uploadAvatar()" style="position:absolute;bottom:0;right:0;width:26px;height:26px;background:var(--color-accent);border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:0.7rem" aria-label="Change photo">📷</button>
        <input type="file" id="avatar-file" accept="image/*" style="display:none" onchange="_handleAvatarFile(event)">
      </div>
      <div class="profile-name">${user.name || 'Your Name'}</div>
      <div class="profile-role-text">${user.email}</div>
      <div class="mt-2"><span class="role-badge ${user.role}">${user.role}</span></div>
    </div>

    <!-- Personal Details -->
    <div class="card mb-4">
      <div class="card-header">
        <h3 class="card-title">Personal Details</h3>
        <button class="btn btn-ghost btn-sm" onclick="_toggleNameEdit()">Edit</button>
      </div>
      <div id="name-view">
        <div class="list-item"><div><div class="list-item-label">Full Name</div><div class="list-item-sub" id="display-name">${user.name || '—'}</div></div></div>
        <div class="list-item" style="border:none"><div><div class="list-item-label">Email</div><div class="list-item-sub">${user.email}</div></div></div>
      </div>
      <div id="name-edit" class="hidden">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="name-input" value="${user.name || ''}"></div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm" onclick="_saveName()">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="_toggleNameEdit()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Password -->
    <div class="card mb-4">
      <div class="card-header"><h3 class="card-title">🔒 Change Password</h3></div>
      <div class="form-group"><label class="form-label">Current Password</label><input class="form-input" type="password" id="pw-old" placeholder="Current password"></div>
      <div class="form-group"><label class="form-label">New Password</label><input class="form-input" type="password" id="pw-new" placeholder="At least 8 characters"></div>
      <div class="form-group"><label class="form-label">Confirm New</label><input class="form-input" type="password" id="pw-confirm" placeholder="Repeat new password"></div>
      <div id="pw-msg"></div>
      <button class="btn btn-primary" onclick="_changePw()">Update Password</button>
    </div>

    <!-- Biometric -->
    <div class="card mb-4">
      <div class="card-header"><h3 class="card-title">🔐 Biometric Login</h3></div>
      ${Auth.hasBiometric()
        ? `<p class="text-muted text-sm mb-4" style="color:var(--color-success)">✓ Enabled on this device</p>
           <button class="btn btn-danger btn-sm" onclick="_removeBio()">Remove Biometric</button>`
        : `<p class="text-muted text-sm mb-4">Not set up on this device.</p>
           <button class="btn btn-accent btn-sm" onclick="_setupBio()">Set Up Biometric</button>`}
    </div>

    <!-- Sign out -->
    <div class="card" style="border-color:var(--color-danger)">
      <button class="btn btn-danger" onclick="Auth.logout()">Sign Out</button>
    </div>`;
}

function _toggleNameEdit() {
  document.getElementById('name-view').classList.toggle('hidden');
  document.getElementById('name-edit').classList.toggle('hidden');
}

async function _saveName() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { Toast.error('Please enter a name'); return; }
  await API.users.update(State.get('user').id, { name });
  State.merge('user', { name });
  document.getElementById('display-name').textContent = name;
  _toggleNameEdit();
  Toast.success('Name updated ✓');
}

function _uploadAvatar() { document.getElementById('avatar-file').click(); }

async function _handleAvatarFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { Toast.error('Max 5MB'); return; }
  await API.users.updateAvatar(State.get('user').id, file);
  Toast.success('Photo updated ✓');
}

async function _changePw() {
  const old = document.getElementById('pw-old').value;
  const nw  = document.getElementById('pw-new').value;
  const cfm = document.getElementById('pw-confirm').value;
  const msg = document.getElementById('pw-msg');
  if (!old || !nw || !cfm) { msg.className='alert alert-error'; msg.textContent='Fill in all fields'; return; }
  if (nw.length < 8) { msg.className='alert alert-error'; msg.textContent='Minimum 8 characters'; return; }
  if (nw !== cfm) { msg.className='alert alert-error'; msg.textContent="Passwords don't match"; return; }
  try {
    await API.users.changePassword(State.get('user').id, old, nw);
    msg.className='alert alert-success'; msg.textContent='Password updated ✓';
    ['pw-old','pw-new','pw-confirm'].forEach(id => document.getElementById(id).value='');
  } catch (err) {
    msg.className='alert alert-error'; msg.textContent=err.data?.message || err.message;
  }
}

async function _setupBio() {
  try {
    await Auth.registerBiometric(State.get('user'));
    Toast.success('Biometric enabled ✓');
    renderAccount(document.getElementById('main-content'));
  } catch (err) {
    if (err.name !== 'NotAllowedError') Toast.error('Setup failed');
  }
}

function _removeBio() {
  Auth.removeBiometric();
  Toast.show('Biometric removed');
  renderAccount(document.getElementById('main-content'));
}

function _acctInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
