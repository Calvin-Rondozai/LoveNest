/*
 * LoveNest Admin data layer.
 *
 * Every screen talks to window.LoveNestApi only. Today it is backed by a mock that
 * stores data in this browser (localStorage) so the dashboard is fully usable before
 * the backend exists. When the server is live, set API_BASE_URL and replace each mock
 * method body with a fetch() call to the matching endpoint. Keep the contract:
 * resolve with data, or reject with an ApiError { code, message, retryAfterMs }.
 *
 * Planned endpoints (Render + Better Auth + Turso + Cloudinary):
 *   POST   /admin/session            sign in (admin role required)
 *   GET    /admin/users              list users
 *   POST   /admin/users              create user
 *   PATCH  /admin/users/:id          update name, role, status
 *   DELETE /admin/users/:id          delete user and their data
 *   GET    /admin/products           list products
 *   POST   /admin/products           create product (image uploaded to Cloudinary)
 *   PATCH  /admin/products/:id       update product
 *   DELETE /admin/products/:id       delete product
 */
(function () {
  'use strict';

  var API_BASE_URL = null; // e.g. 'https://lovenest-api.onrender.com'
  var DEMO_MODE = API_BASE_URL === null;

  var KEYS = {
    users: 'lovenest.admin.users',
    products: 'lovenest.admin.products',
    session: 'lovenest.admin.session',
    limiter: 'lovenest.admin.signin-attempts',
  };

  var CATEGORIES = [
    { id: 'birthday', name: 'Birthday Gifts' },
    { id: 'romance', name: 'Love & Romance' },
    { id: 'flowers', name: 'Flowers' },
    { id: 'toys', name: 'Toys & More' },
    { id: 'corporate', name: 'Corporate Gifts' },
  ];

  function ApiError(code, message, retryAfterMs) {
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
    this.retryAfterMs = retryAfterMs;
  }
  ApiError.prototype = Object.create(Error.prototype);

  // ---------- storage helpers ----------

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new ApiError('storage_full', 'This browser ran out of storage. Try a smaller photo.');
    }
  }
  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms || 350); });
  }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function daysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString();
  }

  // ---------- seed data (demo only) ----------

  function seed() {
    if (!read(KEYS.users, null)) {
      write(KEYS.users, [
        { id: 'u_admin', name: 'LoveNest Admin', email: 'admin@lovenest.app', role: 'admin', provider: 'password', status: 'active', createdAt: daysAgo(40), password: 'Admin1234' },
        { id: 'u_1', name: 'Tendai Moyo', email: 'tendai.moyo@example.com', role: 'customer', provider: 'password', status: 'active', createdAt: daysAgo(1) },
        { id: 'u_2', name: 'Rutendo Chikwanha', email: 'rutendo.c@example.com', role: 'customer', provider: 'google', status: 'active', createdAt: daysAgo(3) },
        { id: 'u_3', name: 'Farai Ndlovu', email: 'farai.ndlovu@example.com', role: 'customer', provider: 'password', status: 'suspended', createdAt: daysAgo(12) },
        { id: 'u_4', name: 'Nyasha Mutasa', email: 'nyasha.m@example.com', role: 'customer', provider: 'google', status: 'active', createdAt: daysAgo(20) },
      ]);
    }
    if (!read(KEYS.products, null)) {
      write(KEYS.products, [
        { id: 'p1', name: 'Red Rose Bouquet', price: 35, categoryId: 'flowers', stock: 12, visible: true, image: null, description: 'A dozen fresh red roses, hand-tied with satin ribbon.', createdAt: daysAgo(30) },
        { id: 'p2', name: 'Cute Teddy Bear', price: 20, categoryId: 'toys', stock: 25, visible: true, image: null, description: 'Soft plush teddy bear with a red bow, 30cm tall.', createdAt: daysAgo(28) },
        { id: 'p3', name: 'Premium Chocolate Box', price: 15, categoryId: 'romance', stock: 40, visible: true, image: null, description: 'Assorted Belgian chocolates in an elegant gift box.', createdAt: daysAgo(20) },
        { id: 'p4', name: 'Birthday Cake Hamper', price: 42, categoryId: 'birthday', stock: 6, visible: true, image: null, description: 'Chocolate cake, balloons and a birthday card, all in one.', createdAt: daysAgo(9) },
        { id: 'p5', name: 'Corporate Gift Set', price: 55, categoryId: 'corporate', stock: 10, visible: true, image: null, description: 'Branded notebook, pen and mug set for your business partners.', createdAt: daysAgo(4) },
        { id: 'p6', name: 'Love Letter Card', price: 8, categoryId: 'romance', stock: 0, visible: false, image: null, description: 'A handwritten-style love note card with envelope.', createdAt: daysAgo(2) },
      ]);
    }
  }

  // Never expose stored passwords to the UI.
  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, provider: u.provider, status: u.status, createdAt: u.createdAt };
  }
  function currentAdmin() {
    var session = read(KEYS.session, null);
    if (!session) throw new ApiError('unauthorized', 'Your session has ended. Please sign in again.');
    return session;
  }

  // ---------- sign-in rate limit (the server must enforce its own) ----------

  var MAX_ATTEMPTS = 5;
  var WINDOW_MS = 15 * 60000;
  var LOCK_MS = 5 * 60000;

  function assertNotLocked() {
    var state = read(KEYS.limiter, { attempts: [], lockedUntil: 0 });
    var wait = state.lockedUntil - Date.now();
    if (wait > 0) throw new ApiError('rate_limited', 'Too many attempts. Try again in ' + Math.ceil(wait / 60000) + ' min.', wait);
  }
  function recordFailure() {
    var now = Date.now();
    var state = read(KEYS.limiter, { attempts: [], lockedUntil: 0 });
    var attempts = state.attempts.filter(function (t) { return now - t < WINDOW_MS; }).concat(now);
    write(KEYS.limiter, attempts.length >= MAX_ATTEMPTS ? { attempts: [], lockedUntil: now + LOCK_MS } : { attempts: attempts, lockedUntil: 0 });
  }

  // ---------- public API ----------

  var api = {
    demoMode: DEMO_MODE,
    categories: CATEGORIES,

    getSession: function () {
      return read(KEYS.session, null);
    },

    signIn: async function (email, password) {
      await delay(500);
      assertNotLocked();
      var users = read(KEYS.users, []);
      var user = users.find(function (u) { return u.email === email.trim().toLowerCase(); });
      if (!user || user.password !== password || user.role !== 'admin' || user.status !== 'active') {
        recordFailure();
        // Same message for every failure so it never reveals which accounts exist.
        throw new ApiError('invalid_credentials', 'Incorrect email or password, or this account is not an admin.');
      }
      write(KEYS.limiter, { attempts: [], lockedUntil: 0 });
      var session = { id: user.id, name: user.name, email: user.email };
      write(KEYS.session, session);
      return session;
    },

    signOut: function () {
      localStorage.removeItem(KEYS.session);
    },

    // Users

    listUsers: async function () {
      await delay();
      currentAdmin();
      return read(KEYS.users, []).map(publicUser);
    },

    createUser: async function (input) {
      await delay();
      currentAdmin();
      var users = read(KEYS.users, []);
      var email = input.email.trim().toLowerCase();
      if (users.some(function (u) { return u.email === email; })) {
        throw new ApiError('email_taken', 'An account with this email already exists.');
      }
      var user = {
        id: uid('u'),
        name: input.name.trim(),
        email: email,
        role: input.role,
        provider: 'password',
        status: 'active',
        createdAt: new Date().toISOString(),
        password: input.password, // demo only: the server stores a hash, never the password
        mustChangePassword: true,
      };
      users.push(user);
      write(KEYS.users, users);
      return publicUser(user);
    },

    updateUser: async function (id, changes) {
      await delay();
      var admin = currentAdmin();
      var users = read(KEYS.users, []);
      var user = users.find(function (u) { return u.id === id; });
      if (!user) throw new ApiError('not_found', 'This user no longer exists.');
      var activeAdmins = users.filter(function (u) { return u.role === 'admin' && u.status === 'active'; });
      var losingAdmin = user.role === 'admin' && user.status === 'active' && (changes.role === 'customer' || changes.status === 'suspended');
      if (losingAdmin && activeAdmins.length === 1) throw new ApiError('last_admin', 'You need at least one active admin.');
      if (id === admin.id && (changes.role === 'customer' || changes.status === 'suspended')) {
        throw new ApiError('self', 'You cannot remove your own admin access.');
      }
      Object.assign(user, { name: changes.name.trim(), role: changes.role, status: changes.status });
      write(KEYS.users, users);
      if (id === admin.id) write(KEYS.session, Object.assign(admin, { name: user.name }));
      return publicUser(user);
    },

    deleteUser: async function (id) {
      await delay();
      var admin = currentAdmin();
      if (id === admin.id) throw new ApiError('self', 'You cannot delete your own account here.');
      var users = read(KEYS.users, []);
      var target = users.find(function (u) { return u.id === id; });
      if (!target) return;
      if (target.role === 'admin' && users.filter(function (u) { return u.role === 'admin'; }).length === 1) {
        throw new ApiError('last_admin', 'You need at least one admin.');
      }
      write(KEYS.users, users.filter(function (u) { return u.id !== id; }));
    },

    // Products

    listProducts: async function () {
      await delay();
      currentAdmin();
      return read(KEYS.products, []);
    },

    saveProduct: async function (input) {
      await delay(450);
      currentAdmin();
      var products = read(KEYS.products, []);
      var existing = input.id && products.find(function (p) { return p.id === input.id; });
      var data = {
        name: input.name.trim(),
        price: input.price,
        categoryId: input.categoryId,
        stock: input.stock,
        visible: input.visible,
        image: input.image, // demo: compressed data URL. Live: Cloudinary URL returned by the server.
        description: input.description.trim(),
      };
      var saved;
      if (existing) {
        saved = Object.assign(existing, data);
      } else {
        saved = Object.assign({ id: uid('p'), createdAt: new Date().toISOString() }, data);
        products.push(saved);
      }
      write(KEYS.products, products);
      return saved;
    },

    deleteProduct: async function (id) {
      await delay();
      currentAdmin();
      write(KEYS.products, read(KEYS.products, []).filter(function (p) { return p.id !== id; }));
    },
  };

  seed();
  window.LoveNestApi = api;
  window.LoveNestApiError = ApiError;
})();
