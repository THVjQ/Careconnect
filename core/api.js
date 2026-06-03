// ════════════════════════════════════════════════════════════
// CareConnect — API Layer
//
// Every PocketBase call lives here. Pages never call pb directly.
// This makes it easy to:
//   • Mock data for testing
//   • Swap backends
//   • Add caching / retry logic in one place
//
// HOW TO EXTEND:
//   Add a new resource section (like API.goals below) following
//   the same pattern: { get, getAll, create, update, delete }
// ════════════════════════════════════════════════════════════

'use strict';

// Initialised by App.boot()
let _pb = null;

const API = (() => {

  // ── Internal helpers ─────────────────────────────────────
  function _requirePB() {
    if (!_pb) throw new Error('[API] PocketBase not initialised. Call API.init() first.');
    return _pb;
  }

  // ── Initialise ────────────────────────────────────────────
  function init(pocketbaseUrl) {
    _pb = new PocketBase(pocketbaseUrl);
    _pb.autoCancellation(false); // Don't auto-cancel on page transitions
    return _pb;
  }

  function pb() { return _requirePB(); }

  // ── Auth ──────────────────────────────────────────────────
  const auth = {
    async login(email, password) {
      return _pb.collection(COLLECTIONS.USERS).authWithPassword(email, password);
    },
    async refresh() {
      if (_pb.authStore.isValid) return _pb.collection(COLLECTIONS.USERS).authRefresh();
      return null;
    },
    logout() {
      _pb.authStore.clear();
    },
    isValid() { return _pb.authStore.isValid; },
    model()   { return _pb.authStore.model;   },
  };

  // ── Users ─────────────────────────────────────────────────
  const users = {
    async getOne(id) {
      return _pb.collection(COLLECTIONS.USERS).getOne(id);
    },
    async update(id, data) {
      return _pb.collection(COLLECTIONS.USERS).update(id, data);
    },
    async updateAvatar(id, file) {
      const form = new FormData();
      form.append('avatar', file);
      return _pb.collection(COLLECTIONS.USERS).update(id, form);
    },
    async changePassword(id, oldPw, newPw) {
      return _pb.collection(COLLECTIONS.USERS).update(id, {
        oldPassword: oldPw, password: newPw, passwordConfirm: newPw,
      });
    },
    getAvatarUrl(user, size = 100) {
      if (!user?.avatar) return null;
      return _pb.files.getUrl(user, user.avatar, { thumb: `${size}x${size}` });
    },
  };

  // ── Staff ─────────────────────────────────────────────────
  const staff = {
    async getAll() {
      return _pb.collection(COLLECTIONS.STAFF).getFullList({
        expand: 'user_id', sort: 'user_id.name',
      });
    },
    async getByUser(userId) {
      return _pb.collection(COLLECTIONS.STAFF).getFirstListItem(
        `user_id = "${userId}"`
      );
    },
    async update(id, data) {
      return _pb.collection(COLLECTIONS.STAFF).update(id, data);
    },
  };

  // ── Clients ───────────────────────────────────────────────
  const clients = {
    async getAll() {
      return _pb.collection(COLLECTIONS.CLIENTS).getFullList({
        expand: 'user_id', sort: 'user_id.name',
      });
    },
    async getOne(id) {
      return _pb.collection(COLLECTIONS.CLIENTS).getOne(id, {
        expand: 'user_id',
      });
    },
    async getByUser(userId) {
      return _pb.collection(COLLECTIONS.CLIENTS).getFirstListItem(
        `user_id = "${userId}"`, { expand: 'user_id' }
      );
    },
    async update(id, data) {
      return _pb.collection(COLLECTIONS.CLIENTS).update(id, data);
    },
  };

  // ── Shifts ────────────────────────────────────────────────
  const shifts = {
    _expand: 'client_id,staff_ids,client_id.user_id',

    async getForWeek(startDate, endDate, extraFilter = '') {
      let filter = `date >= "${startDate}" && date <= "${endDate}"`;
      if (extraFilter) filter += ` && ${extraFilter}`;
      return _pb.collection(COLLECTIONS.SHIFTS).getFullList({
        filter, expand: this._expand, sort: 'date,start_time',
      });
    },
    async getForStaff(staffId, startDate, endDate) {
      return this.getForWeek(startDate, endDate, `staff_ids ~ "${staffId}"`);
    },
    async getForClient(clientId, startDate, endDate) {
      return this.getForWeek(startDate, endDate, `client_id = "${clientId}"`);
    },
    async getToday() {
      const today = new Date().toISOString().split('T')[0];
      return this.getForWeek(today, today);
    },
    async create(data) {
      return _pb.collection(COLLECTIONS.SHIFTS).create({
        status: SHIFT_STATUS.SCHEDULED,
        report_completed: false,
        invoice_sent:     false,
        wages_paid:       false,
        ...data,
      });
    },
    async update(id, data) {
      return _pb.collection(COLLECTIONS.SHIFTS).update(id, data);
    },
    async cancel(id, reason) {
      return _pb.collection(COLLECTIONS.SHIFTS).update(id, {
        status: SHIFT_STATUS.CANCELLED,
        cancel_reason: reason,
        cancelled_at:  new Date().toISOString(),
      });
    },
    async request(data) {
      // Client requests a shift → admin approves
      return _pb.collection(COLLECTIONS.SHIFTS).create({
        ...data,
        status:       SHIFT_STATUS.PENDING,
        requested_by: _pb.authStore.model.id,
      });
    },
  };

  // ── Shift Reports ─────────────────────────────────────────
  const reports = {
    async getForShift(shiftId) {
      try {
        return await _pb.collection(COLLECTIONS.SHIFT_REPORTS)
          .getFirstListItem(`shift_id = "${shiftId}"`);
      } catch { return null; }
    },
    async getForClient(clientId, page = 1, perPage = 20) {
      return _pb.collection(COLLECTIONS.SHIFT_REPORTS).getList(page, perPage, {
        filter: `shift_id.client_id = "${clientId}"`,
        expand: 'shift_id,submitted_by',
        sort:   '-submitted_at',
      });
    },
    async submit(data) {
      // Immutable — check for existing first
      const existing = await this.getForShift(data.shift_id);
      if (existing) throw new Error('Report already submitted and cannot be changed.');
      const record = await _pb.collection(COLLECTIONS.SHIFT_REPORTS).create({
        ...data,
        submitted_by: _pb.authStore.model.id,
        submitted_at: new Date().toISOString(),
      });
      // Mark shift as complete
      await shifts.update(data.shift_id, { report_completed: true });
      return record;
    },
  };

  // ── Goals ─────────────────────────────────────────────────
  const goals = {
    async getForClient(clientId) {
      return _pb.collection(COLLECTIONS.GOALS).getFullList({
        filter: `client_id = "${clientId}" && active = true`,
        sort: 'created',
      });
    },
    async create(clientId, title, description = '') {
      return _pb.collection(COLLECTIONS.GOALS).create({
        client_id: clientId, title, description, active: true,
      });
    },
    async deactivate(id) {
      return _pb.collection(COLLECTIONS.GOALS).update(id, { active: false });
    },
    async delete(id) {
      return _pb.collection(COLLECTIONS.GOALS).delete(id);
    },
  };

  // ── Incidents ─────────────────────────────────────────────
  const incidents = {
    async getForClient(clientId) {
      return _pb.collection(COLLECTIONS.INCIDENTS).getFullList({
        filter: `client_id = "${clientId}"`,
        expand: 'reported_by',
        sort:   '-reported_at',
      });
    },
    async create(data) {
      return _pb.collection(COLLECTIONS.INCIDENTS).create({
        ...data,
        reported_by: _pb.authStore.model.id,
        reported_at: new Date().toISOString(),
      });
    },
  };

  // ── Availability (staff blocks) ───────────────────────────
  const availability = {
    async getForStaff(staffId) {
      return _pb.collection(COLLECTIONS.AVAILABILITY).getFullList({
        filter: `staff_id = "${staffId}"`, sort: 'start_date',
      });
    },
    async create(staffId, startDate, endDate, reason = '') {
      return _pb.collection(COLLECTIONS.AVAILABILITY).create({
        staff_id: staffId, start_date: startDate, end_date: endDate, reason,
      });
    },
    async delete(id) {
      return _pb.collection(COLLECTIONS.AVAILABILITY).delete(id);
    },
  };

  // ── Messaging ─────────────────────────────────────────────
  const messaging = {
    async getRooms(userId) {
      return _pb.collection(COLLECTIONS.ROOMS).getFullList({
        filter: `members ~ "${userId}"`, sort: '-updated',
      });
    },
    async createRoom(name, type, memberIds) {
      return _pb.collection(COLLECTIONS.ROOMS).create({ name, type, members: memberIds });
    },
    async getOrCreateDirect(userId1, userId2) {
      try {
        return await _pb.collection(COLLECTIONS.ROOMS).getFirstListItem(
          `type = "direct" && members ~ "${userId1}" && members ~ "${userId2}"`
        );
      } catch {
        return await this.createRoom(`${userId1}-${userId2}`, 'direct', [userId1, userId2]);
      }
    },
    async getMessages(roomId, page = 1, perPage = 50) {
      return _pb.collection(COLLECTIONS.MESSAGES).getList(page, perPage, {
        filter: `room_id = "${roomId}"`,
        expand: 'sender_id',
        sort:   'created',
      });
    },
    async sendMessage(roomId, content) {
      return _pb.collection(COLLECTIONS.MESSAGES).create({
        room_id:   roomId,
        sender_id: _pb.authStore.model.id,
        content,
      });
    },
    subscribeMessages(roomId, callback) {
      _pb.collection(COLLECTIONS.MESSAGES).subscribe('*', (e) => {
        if (e.record.room_id === roomId && e.action === 'create') callback(e.record);
      });
    },
    unsubscribeMessages() {
      _pb.collection(COLLECTIONS.MESSAGES).unsubscribe();
    },
  };

  // ── Notifications ─────────────────────────────────────────
  const notifications = {
    async getForUser(userId, unreadOnly = false) {
      const filter = unreadOnly
        ? `recipient_id = "${userId}" && read = false`
        : `recipient_id = "${userId}"`;
      return _pb.collection(COLLECTIONS.NOTIFICATIONS).getList(1, 50, {
        filter, sort: '-created',
      });
    },
    async markRead(id) {
      return _pb.collection(COLLECTIONS.NOTIFICATIONS).update(id, { read: true });
    },
    async markAllRead(userId) {
      const { items } = await this.getForUser(userId, true);
      return Promise.all(items.map(n => this.markRead(n.id)));
    },
    async create(recipientId, title, body, url = '/') {
      return _pb.collection(COLLECTIONS.NOTIFICATIONS).create({
        recipient_id: recipientId, title, body, url, read: false,
      });
    },
    subscribeForUser(userId, callback) {
      _pb.collection(COLLECTIONS.NOTIFICATIONS).subscribe('*', (e) => {
        if (e.record.recipient_id === userId && e.action === 'create') {
          callback(e.record);
        }
      });
    },
    unsubscribe() {
      _pb.collection(COLLECTIONS.NOTIFICATIONS).unsubscribe();
    },
  };

  // ── Push Subscriptions ────────────────────────────────────
  const push = {
    async save(userId, subscription) {
      try {
        const existing = await _pb.collection(COLLECTIONS.PUSH_SUBS)
          .getFirstListItem(`user_id = "${userId}"`);
        return _pb.collection(COLLECTIONS.PUSH_SUBS).update(existing.id, {
          subscription: JSON.stringify(subscription),
        });
      } catch {
        return _pb.collection(COLLECTIONS.PUSH_SUBS).create({
          user_id: userId, subscription: JSON.stringify(subscription),
        });
      }
    },
  };

  // ── Public surface ────────────────────────────────────────
  return Object.freeze({
    init, pb,
    auth, users, staff, clients,
    shifts, reports, goals, incidents, availability,
    messaging, notifications, push,
  });

})();
