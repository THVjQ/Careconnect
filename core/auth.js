// ════════════════════════════════════════════════════════════
// CareConnect — Authentication
//
// Handles: password login, WebAuthn biometrics, session restore,
//          logout, and the login screen UI bindings.
// ════════════════════════════════════════════════════════════

'use strict';

const Auth = (() => {

  // ── Initialise login screen ──────────────────────────────
  function init() {
    // Button bindings
    _el('btn-login').addEventListener('click', login);
    _el('btn-biometric').addEventListener('click', biometricLogin);
    _el('pw-toggle').addEventListener('click', _togglePassword);

    // Keyboard shortcuts
    _el('input-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    _el('input-email').addEventListener('keydown',    e => { if (e.key === 'Enter') _el('input-password').focus(); });

    // Show biometric button if credential exists on this device
    _refreshBiometricButton();
  }

  // ── Password login ────────────────────────────────────────
  async function login() {
    const email    = _el('input-email').value.trim();
    const password = _el('input-password').value;

    if (!email || !password) { _setError('Please enter your email and password.'); return; }

    _setLoading(true);
    _setError('');

    try {
      const result = await API.auth.login(email, password);
      await _onLoginSuccess(result.record);

      // Offer biometric setup after first successful password login
      if (!_hasBiometricCredential()) {
        await _offerBiometricSetup(result.record);
      }

    } catch (err) {
      _setError(
        err.status === 400
          ? 'Incorrect email or password.'
          : 'Login failed — check your connection and try again.'
      );
    } finally {
      _setLoading(false);
    }
  }

  // ── Biometric login (WebAuthn) ────────────────────────────
  async function biometricLogin() {
    const credId = localStorage.getItem('cc_bio_cred_id');
    const email  = localStorage.getItem('cc_bio_email');

    if (!credId || !email) {
      _setError('No biometric saved. Sign in with your password first.');
      return;
    }

    _el('biometric-label').textContent = 'Verifying…';
    _el('btn-biometric').disabled = true;

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const rawId     = Uint8Array.from(atob(credId), c => c.charCodeAt(0));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: location.hostname,
          allowCredentials: [{ type: 'public-key', id: rawId }],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (!assertion) throw new Error('Biometric check failed');

      // Re-use existing valid session, or prompt password if expired
      if (API.auth.isValid()) {
        await _onLoginSuccess(API.auth.model());
      } else {
        _setError('Session expired — please sign in with your password.');
        _el('input-email').value = email;
      }

    } catch (err) {
      _setError(err.name === 'NotAllowedError' ? 'Biometric cancelled.' : 'Biometric failed. Use your password.');
    } finally {
      _el('biometric-label').textContent = _getBiometricLabel();
      _el('btn-biometric').disabled = false;
    }
  }

  // ── Register biometric ────────────────────────────────────
  async function registerBiometric(user) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId    = new TextEncoder().encode(user.id);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: APP.NAME, id: location.hostname },
        user: { id: userId, name: user.email, displayName: user.name || user.email },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7   }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    });

    const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem('cc_bio_cred_id', credId);
    localStorage.setItem('cc_bio_email',   user.email);

    _refreshBiometricButton();
    return credential;
  }

  // ── Remove biometric from this device ─────────────────────
  function removeBiometric() {
    localStorage.removeItem('cc_bio_cred_id');
    localStorage.removeItem('cc_bio_email');
    _refreshBiometricButton();
  }

  function hasBiometric() { return _hasBiometricCredential(); }

  // ── Logout ────────────────────────────────────────────────
  async function logout() {
    // Unsubscribe real-time connections
    try { API.messaging.unsubscribeMessages(); }    catch {}
    try { API.notifications.unsubscribe(); }        catch {}

    API.auth.logout();
    State.reset();

    _showScreen('login');
    _el('input-email').value    = '';
    _el('input-password').value = '';
    _setError('');

    Events.emit('user:logout');
  }

  // ── Session restore on page load ──────────────────────────
  async function tryRestoreSession() {
    if (!API.auth.isValid()) return false;
    try {
      await API.auth.refresh();
      return true;
    } catch {
      API.auth.logout();
      return false;
    }
  }

  // ── Internal helpers ──────────────────────────────────────
  async function _onLoginSuccess(user) {
    State.set('user',       user);
    State.set('isLoggedIn', true);

    _showScreen('app');
    Events.emit('user:login', { user });
  }

  async function _offerBiometricSetup(user) {
    const supported = await _isWebAuthnSupported();
    if (!supported) return;

    const ok = confirm(`Enable ${_getBiometricLabel()} for faster sign-in next time?`);
    if (!ok) return;

    try {
      await registerBiometric(user);
      // Toast shown by app.js listener
      Events.emit('auth:biometric-registered');
    } catch {}
  }

  async function _isWebAuthnSupported() {
    return (
      !!window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    );
  }

  function _hasBiometricCredential() {
    return !!localStorage.getItem('cc_bio_cred_id');
  }

  function _getBiometricLabel() {
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|mac/.test(ua) ? 'Face ID / Touch ID' : 'Fingerprint / Face Unlock';
  }

  async function _refreshBiometricButton() {
    const supported = await _isWebAuthnSupported().catch(() => false);
    const wrap      = _el('biometric-wrap');
    const label     = _el('biometric-label');
    if (supported && _hasBiometricCredential()) {
      label.textContent = _getBiometricLabel();
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
    }
  }

  function _togglePassword() {
    const input = _el('input-password');
    input.type  = input.type === 'password' ? 'text' : 'password';
  }

  function _setLoading(loading) {
    const btn = _el('btn-login');
    btn.querySelector('.btn-text').classList.toggle('hidden', loading);
    btn.querySelector('.btn-spinner').classList.toggle('hidden', !loading);
    btn.disabled = loading;
  }

  function _setError(msg) {
    const el      = _el('login-error');
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  function _showScreen(name) {
    _el('screen-login').classList.toggle('active', name === 'login');
    _el('screen-login').classList.toggle('hidden', name !== 'login');
    _el('screen-app').classList.toggle('active',  name === 'app');
    _el('screen-app').classList.toggle('hidden',  name !== 'app');
  }

  function _el(id) { return document.getElementById(id); }

  return Object.freeze({ init, login, biometricLogin, registerBiometric, removeBiometric, hasBiometric, logout, tryRestoreSession });
})();
