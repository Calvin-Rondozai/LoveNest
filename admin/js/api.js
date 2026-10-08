/*
 * LoveNest Admin data layer. Talks to the LoveNest API (server/), which also serves this
 * dashboard at /admin, so requests are same-origin and use the session cookie.
 *
 * Every method resolves with data or rejects with an ApiError { code, message, fields, retryAfterMs }.
 */
(function () {
  'use strict';

  // Same origin by default. Set window.LOVENEST_API_URL (js/config.js) only if the dashboard
  // is hosted somewhere else.
  var BASE = (window.LOVENEST_API_URL || '').replace(/\/$/, '');
  var TIMEOUT_MS = 20000;

  function ApiError(code, message, fields, retryAfterMs) {
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
    this.fields = fields || null;
    this.retryAfterMs = retryAfterMs;
  }
  ApiError.prototype = Object.create(Error.prototype);

  async function request(path, options) {
    options = options || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    var init = { method: options.method || 'GET', credentials: 'include', headers: {}, signal: controller.signal };
    if (options.form) {
      init.body = options.form; // the browser sets the multipart boundary
    } else if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    var res;
    try {
      res = await fetch(BASE + path, init);
    } catch (e) {
      throw new ApiError('network', e && e.name === 'AbortError'
        ? 'The server took too long to respond. Check your connection and try again.'
        : 'Can\'t reach the LoveNest server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 204) return null;
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!res.ok) {
      var err = (data && data.error) || {};
      var retry = Number(res.headers.get('Retry-After')) || 0;
      // Better Auth errors use { message, code } at the top level.
      var message = err.message || (data && data.message) || 'Something went wrong. Please try again.';
      var code = err.code || (data && data.code && String(data.code).toLowerCase()) || (res.status === 401 ? 'unauthorized' : res.status === 429 ? 'rate_limited' : 'error');
      if (res.status === 429 && !err.message) message = 'Too many attempts. Please wait a moment and try again.';
      throw new ApiError(code, message, err.fields, retry ? retry * 1000 : undefined);
    }
    return data;
  }

  // Server prices are in cents; the dashboard edits dollars.
  function fromProduct(p) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.priceCents / 100,
      categoryId: p.categoryId,
      stock: p.stock,
      visible: p.visible,
      image: p.image && p.image.charAt(0) === '/' ? BASE + p.image : p.image,
      createdAt: p.createdAt,
    };
  }

  var api = {
    categories: [],
    session: null,

    // ---------- session ----------

    /** Restores the session from the cookie. Resolves with the admin or null. */
    loadSession: async function () {
      try {
        var data = await request('/api/me');
        api.session = data.user.role === 'admin' ? data.user : null;
      } catch (e) {
        if (e.code === 'network') throw e;
        api.session = null;
      }
      return api.session;
    },

    getSession: function () { return api.session; },

    signIn: async function (email, password) {
      await request('/api/auth/sign-in/email', { method: 'POST', body: { email: email.trim(), password: password } });
      var data = await request('/api/me');
      if (data.user.role !== 'admin') {
        await api.signOut();
        throw new ApiError('not_admin', 'This account is not an admin. Use the LoveNest app instead.');
      }
      api.session = data.user;
      return api.session;
    },

    changePassword: async function (currentPassword, newPassword) {
      await request('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: currentPassword, newPassword: newPassword, revokeOtherSessions: true },
      });
      return api.loadSession();
    },

    signOut: async function () {
      api.session = null;
      try { await request('/api/auth/sign-out', { method: 'POST', body: {} }); } catch (e) { /* already signed out */ }
    },

    // ---------- catalog ----------

    loadCategories: async function () {
      var data = await request('/api/categories');
      api.categories = data.categories;
      return api.categories;
    },

    // ---------- users ----------

    listUsers: async function () {
      return (await request('/api/admin/users')).users;
    },
    createUser: async function (input) {
      return (await request('/api/admin/users', { method: 'POST', body: input })).user;
    },
    updateUser: async function (id, changes) {
      return (await request('/api/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: changes })).user;
    },
    deleteUser: async function (id) {
      await request('/api/admin/users/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    // ---------- products ----------

    listProducts: async function () {
      return (await request('/api/admin/products')).products.map(fromProduct);
    },

    /**
     * Creates or updates a product. `imageBlob` uploads a new photo; `removeImage` clears it.
     */
    saveProduct: async function (input) {
      var body = {
        name: input.name,
        description: input.description || '',
        priceCents: Math.round(Number(input.price) * 100),
        categoryId: input.categoryId,
        stock: input.stock,
        visible: input.visible,
      };
      var saved = input.id
        ? (await request('/api/admin/products/' + encodeURIComponent(input.id), { method: 'PATCH', body: body })).product
        : (await request('/api/admin/products', { method: 'POST', body: body })).product;

      if (input.imageBlob) {
        var form = new FormData();
        form.append('image', input.imageBlob, 'photo.jpg');
        saved = (await request('/api/admin/products/' + encodeURIComponent(saved.id) + '/image', { method: 'POST', form: form })).product;
      } else if (input.removeImage) {
        saved = (await request('/api/admin/products/' + encodeURIComponent(saved.id) + '/image', { method: 'DELETE' })).product;
      }
      return fromProduct(saved);
    },

    deleteProduct: async function (id) {
      await request('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    // ---------- orders ----------

    listOrders: async function () {
      return (await request('/api/admin/orders')).orders;
    },
    updateOrderStatus: async function (id, status, note) {
      return (await request('/api/admin/orders/' + encodeURIComponent(id) + '/status', {
        method: 'POST',
        body: { status: status, note: note || '' },
      })).order;
    },
  };

  window.LoveNestApi = api;
  window.LoveNestApiError = ApiError;
})();
