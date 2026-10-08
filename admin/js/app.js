/* LoveNest Admin: UI controller. Data access goes through window.LoveNestApi only. */
(function () {
  'use strict';

  var api = window.LoveNestApi;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var flow = window.OrderStatus;

  var state = {
    users: [],
    products: [],
    orders: [],
    orderQuery: '',
    orderFilter: 'active',
    openOrderId: null,
    productQuery: '',
    productCategory: 'all',
    userQuery: '',
    userRole: 'all',
    pendingImage: undefined, // undefined = unchanged, null = removed, { blob, url } = new photo
  };

  // ---------- helpers ----------

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) { return 'US$' + Number(n).toFixed(2); }
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function relativeDay(iso) {
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return formatDate(iso);
  }
  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join('');
  }
  function categoryName(id) {
    var c = api.categories.find(function (x) { return x.id === id; });
    return c ? c.name : 'Uncategorised';
  }

  // ---------- validation (mirrors the mobile app's rules) ----------

  var EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

  var rules = {
    email: function (v) {
      v = v.trim();
      if (!v) return 'Enter an email address.';
      return v.length <= 254 && EMAIL_RE.test(v) && v.indexOf('..') === -1 ? null : 'Enter a valid email address.';
    },
    personName: function (v) {
      v = v.trim().replace(/\s+/g, ' ');
      if (!v) return 'Enter a full name.';
      if (v.length < 2) return 'This name looks too short.';
      if (v.length > 60) return 'Keep the name under 60 characters.';
      return NAME_RE.test(v) ? null : 'Use letters, spaces, hyphens or apostrophes only.';
    },
    password: function (v) {
      if (!v) return 'Enter a temporary password.';
      if (v.length < 8) return 'Use at least 8 characters.';
      if (v.length > 128) return 'Keep it under 128 characters.';
      if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Include at least one letter and one number.';
      return null;
    },
    productName: function (v) {
      v = v.trim();
      if (!v) return 'Enter a product name.';
      if (v.length < 2) return 'This name looks too short.';
      return v.length > 80 ? 'Keep the name under 80 characters.' : null;
    },
    price: function (v) {
      v = v.trim();
      if (!v) return 'Enter a price.';
      if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) return 'Enter a price like 25 or 25.50.';
      var n = Number(v);
      if (n <= 0) return 'The price must be more than zero.';
      return n > 10000 ? 'The price looks too high.' : null;
    },
    stock: function (v) {
      v = v.trim();
      if (!v) return null;
      return /^\d{1,5}$/.test(v) ? null : 'Enter a whole number for stock.';
    },
    description: function (v) {
      return v.trim().length > 500 ? 'Keep the description under 500 characters.' : null;
    },
  };

  function clearErrors(form) {
    $$('.field-error', form).forEach(function (el) { el.hidden = true; el.textContent = ''; });
    $$('.is-invalid-row', form).forEach(function (el) { el.classList.remove('is-invalid-row'); });
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }
  function showErrors(form, errors, inputs) {
    var first = null;
    Object.keys(errors).forEach(function (key) {
      var msg = errors[key];
      if (!msg) return;
      var el = $('[data-error-for="' + key + '"]', form);
      if (el) {
        el.innerHTML = '<i class="bi bi-exclamation-circle" aria-hidden="true"></i>' + esc(msg);
        el.hidden = false;
      }
      var input = inputs && inputs[key];
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        var row = input.closest('.field-row');
        if (row) row.classList.add('is-invalid-row');
        if (!first) first = input;
      }
    });
    if (first) first.focus();
    return Object.keys(errors).some(function (k) { return errors[k]; });
  }
  // Editing a field clears its own error so stale messages never linger.
  function clearFieldError(e) {
    var input = e.target;
    var key = Object.keys(input.form ? (input.form === productForm ? productInputs : userInputs) : {}).find(function (k) {
      return (input.form === productForm ? productInputs : userInputs)[k] === input;
    });
    if (!key) return;
    input.removeAttribute('aria-invalid');
    var row = input.closest('.field-row');
    if (row) row.classList.remove('is-invalid-row');
    var el = $('[data-error-for="' + key + '"]', input.form);
    if (el) el.hidden = true;
  }

  function setBusy(button, busy, busyLabel) {
    if (!button.dataset.label) button.dataset.label = button.innerHTML;
    button.disabled = busy;
    button.innerHTML = busy ? esc(busyLabel) : button.dataset.label;
  }

  // ---------- toast and confirm ----------

  var toastEl = $('#toast');
  var toast = new bootstrap.Toast(toastEl);
  function notify(message, isError) {
    toastEl.classList.toggle('is-error', !!isError);
    $('i', toastEl).className = isError ? 'bi bi-exclamation-circle-fill' : 'bi bi-check-circle-fill';
    $('#toast-text').textContent = message;
    toast.show();
  }

  var confirmModalEl = $('#confirm-modal');
  var confirmModal = new bootstrap.Modal(confirmModalEl);
  function confirmDestructive(title, message, actionLabel, cancelLabel) {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#confirm-ok').textContent = actionLabel || 'Delete';
    $('#confirm-cancel').textContent = cancelLabel || 'Cancel';
    return new Promise(function (resolve) {
      var accepted = false;
      var ok = $('#confirm-ok');
      var onOk = function () { accepted = true; confirmModal.hide(); };
      ok.addEventListener('click', onOk, { once: true });
      confirmModalEl.addEventListener('hidden.bs.modal', function () {
        ok.removeEventListener('click', onOk);
        resolve(accepted);
      }, { once: true });
      confirmModal.show();
    });
  }

  function handleError(err) {
    if (err && err.code === 'unauthorized') {
      api.signOut();
      showLogin();
      notify('Your session has ended. Please sign in again.', true);
      return;
    }
    if (err && err.code === 'password_change_required') {
      showPasswordChange();
      return;
    }
    notify((err && err.message) || 'Something went wrong. Please try again.', true);
  }

  // ---------- sign in ----------

  var loginView = $('#login-view');
  var appView = $('#app-view');

  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
    $('#login-form').hidden = false;
    $('#password-form').hidden = true;
    $('#login-email').focus();
  }

  function showPasswordChange() {
    appView.hidden = true;
    loginView.hidden = false;
    $('#login-form').hidden = true;
    $('#password-form').hidden = false;
    $('#pw-current').focus();
  }

  function showApp(session) {
    if (session.mustChangePassword) return showPasswordChange();
    loginView.hidden = true;
    appView.hidden = false;
    $$('[data-admin-name]').forEach(function (el) { el.textContent = session.name; });
    $$('[data-admin-email]').forEach(function (el) { el.textContent = session.email; });
    loadAll().then(route);
  }

  $('#password-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var current = $('#pw-current').value;
    var next = $('#pw-new').value;
    var errorEl = $('#password-error');
    var button = $('#password-submit');
    errorEl.hidden = true;
    var problem = !current ? 'Enter your temporary password.'
      : rules.password(next) ? rules.password(next).replace('temporary ', '')
      : next !== $('#pw-confirm').value ? 'The new passwords do not match.'
      : next === current ? 'Choose a password different from the temporary one.' : null;
    if (problem) {
      errorEl.textContent = problem;
      errorEl.hidden = false;
      return;
    }
    setBusy(button, true, 'Saving…');
    try {
      var session = await api.changePassword(current, next);
      this.reset();
      if (session) showApp(session);
      else showLogin();
      notify('Password changed');
    } catch (err) {
      errorEl.textContent = err.code === 'invalid_password' ? 'Your temporary password is incorrect.' : err.message;
      errorEl.hidden = false;
    } finally {
      setBusy(button, false);
    }
  });

  $('#login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = $('#login-email');
    var password = $('#login-password');
    var errorEl = $('#login-error');
    var button = $('#login-submit');
    errorEl.hidden = true;

    var problem = rules.email(email.value) || (password.value ? null : 'Enter your password.');
    if (problem) {
      errorEl.textContent = problem;
      errorEl.hidden = false;
      return;
    }
    setBusy(button, true, 'Signing In…');
    try {
      var session = await api.signIn(email.value, password.value);
      password.value = '';
      showApp(session);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      setBusy(button, false);
    }
  });

  document.addEventListener('click', async function (e) {
    if (e.target.closest('[data-action="sign-out"]')) {
      await api.signOut();
      showLogin();
    }
  });

  // ---------- navigation ----------

  var PAGES = { overview: 'Overview', orders: 'Orders', products: 'Products', users: 'Users' };

  function route() {
    var page = (location.hash.replace('#/', '') || 'overview').split('?')[0];
    if (!PAGES[page]) page = 'overview';
    $$('[data-page]').forEach(function (s) { s.hidden = s.dataset.page !== page; });
    $$('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('#toolbar-title').textContent = PAGES[page];
    document.title = PAGES[page] + ' · LoveNest Admin';
    window.scrollTo(0, 0);
    render();
  }
  window.addEventListener('hashchange', route);

  var toolbar = $('.toolbar');
  window.addEventListener('scroll', function () {
    toolbar.classList.toggle('scrolled', window.scrollY > 36);
  }, { passive: true });

  $('#sidebar-toggle').addEventListener('click', function () {
    var hidden = appView.classList.toggle('sidebar-hidden');
    this.setAttribute('aria-expanded', String(!hidden));
    this.setAttribute('aria-label', hidden ? 'Show sidebar' : 'Hide sidebar');
  });

  // ---------- data ----------

  async function loadAll() {
    try {
      var results = await Promise.all([api.listUsers(), api.listProducts(), api.listOrders(), api.loadCategories()]);
      state.users = results[0];
      state.products = results[1];
      state.orders = results[2];
      fillCategorySelects();
    } catch (err) {
      handleError(err);
    }
  }

  function render() {
    renderOverview();
    renderOrders();
    renderProducts();
    renderUsers();
  }

  // ---------- overview ----------

  function renderOverview() {
    var weekAgo = Date.now() - 7 * 86400000;
    var customers = state.users.filter(function (u) { return u.role === 'customer'; });
    $('#stat-customers').textContent = customers.length;
    $('#stat-new').textContent = customers.filter(function (u) { return new Date(u.createdAt).getTime() > weekAgo; }).length;
    $('#stat-products').textContent = state.products.length;
    var openOrders = state.orders.filter(function (o) { return !flow.isFinal(o.status); });
    $('#stat-open-orders').textContent = openOrders.length;
    // Oldest first: the order waiting longest needs attention first.
    var toHandle = openOrders.slice().sort(function (a, b) { return new Date(a.placedAt) - new Date(b.placedAt); }).slice(0, 5);
    $('#open-orders-list').innerHTML = toHandle.length ? toHandle.map(function (o) {
      var info = flow.INFO[o.status];
      return '<li class="row-link" tabindex="0" role="button" data-action="open-order" data-id="' + esc(o.id) + '">' +
        '<i class="bi ' + info.icon + ' list-icon" aria-hidden="true"></i>' +
        '<span class="list-text"><span class="list-title">' + esc(o.orderNumber) + ' · ' + esc(o.customerName) + '</span>' +
        '<span class="list-subtitle">' + esc(info.label) + ' · ' + esc(relativeDay(o.placedAt)) + '</span></span>' +
        '<span class="meta">' + money(o.total) + '</span><i class="bi bi-chevron-right chevron" aria-hidden="true"></i></li>';
    }).join('') : '<li class="empty-row"><i class="bi bi-check2-all" aria-hidden="true"></i>&nbsp;All caught up</li>';

    var recentUsers = state.users.slice().sort(byNewest).slice(0, 5);
    $('#recent-users').innerHTML = recentUsers.length ? recentUsers.map(function (u) {
      return '<li><span class="avatar" aria-hidden="true">' + esc(initials(u.name)) + '</span>' +
        '<span class="list-text"><span class="list-title">' + esc(u.name) + '</span><span class="list-subtitle">' + esc(u.email) + '</span></span>' +
        '<span class="meta">' + esc(relativeDay(u.createdAt)) + '</span></li>';
    }).join('') : '<li class="empty-row">No users yet</li>';

    var recentProducts = state.products.slice().sort(byNewest).slice(0, 5);
    $('#recent-products').innerHTML = recentProducts.length ? recentProducts.map(function (p) {
      return '<li>' + thumb(p) +
        '<span class="list-text"><span class="list-title">' + esc(p.name) + '</span><span class="list-subtitle">' + esc(categoryName(p.categoryId)) + '</span></span>' +
        '<span class="meta">' + money(p.price) + '</span></li>';
    }).join('') : '<li class="empty-row">No products yet</li>';
  }
  function byNewest(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }
  function thumb(p) {
    return p.image
      ? '<img class="thumb" src="' + esc(p.image) + '" alt="">'
      : '<span class="thumb thumb-placeholder" aria-hidden="true"><i class="bi bi-image"></i></span>';
  }

  // ---------- orders ----------

  var PAYMENT_METHOD = { ecocash: 'EcoCash', onemoney: 'OneMoney', cod: 'Cash on Delivery' };

  function paymentLabel(o) {
    if (o.status === 'cancelled' && o.paymentStatus === 'paid') return '<span class="status refund-flag"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>Refund due</span>';
    if (o.paymentStatus === 'paid') return '<span class="status status-ok"><i class="bi bi-check-circle" aria-hidden="true"></i>Paid</span>';
    if (o.paymentStatus === 'failed') return '<span class="status status-warn"><i class="bi bi-x-octagon" aria-hidden="true"></i>Payment failed</span>';
    if (o.paymentStatus === 'refunded') return '<span class="status status-off"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>Refunded</span>';
    return o.paymentMethod === 'cod'
      ? '<span class="status status-off"><i class="bi bi-cash" aria-hidden="true"></i>Pay on delivery</span>'
      : '<span class="status status-warn"><i class="bi bi-hourglass-split" aria-hidden="true"></i>Awaiting payment</span>';
  }

  function statusLabel(status) {
    var info = flow.INFO[status];
    var cls = status === 'delivered' ? 'status-ok' : status === 'cancelled' ? 'status-off' : 'role-admin';
    return '<span class="status ' + cls + '"><i class="bi ' + info.icon + '" aria-hidden="true"></i>' + esc(info.label) + '</span>';
  }

  $('#order-search').addEventListener('input', function () { state.orderQuery = this.value; renderOrders(); });
  $('#order-filter').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.orderFilter = btn.dataset.filter;
    $$('[data-filter]', this).forEach(function (b) { b.setAttribute('aria-checked', String(b === btn)); });
    renderOrders();
  });

  function renderOrders() {
    var q = state.orderQuery.trim().toLowerCase();
    var list = state.orders.filter(function (o) {
      if (state.orderFilter === 'active' && flow.isFinal(o.status)) return false;
      if (state.orderFilter === 'delivered' && o.status !== 'delivered') return false;
      if (state.orderFilter === 'cancelled' && o.status !== 'cancelled') return false;
      if (!q) return true;
      return (o.orderNumber + ' ' + o.customerName + ' ' + o.customerEmail + ' ' + o.recipientName + ' ' + o.city).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      // Active orders: oldest first so nothing waits too long. Others: newest first.
      return state.orderFilter === 'active' ? new Date(a.placedAt) - new Date(b.placedAt) : new Date(b.placedAt) - new Date(a.placedAt);
    });

    $('#orders-empty').hidden = list.length > 0;
    $('#orders-table-card').hidden = list.length === 0;
    $('#order-rows').innerHTML = list.map(function (o) {
      return '<tr class="row-link" tabindex="0" data-action="open-order" data-id="' + esc(o.id) + '" aria-label="Order ' + esc(o.orderNumber) + ', ' + esc(flow.INFO[o.status].label) + '">' +
        '<td><span class="list-text"><span class="list-title">' + esc(o.orderNumber) + '</span><span class="list-subtitle">' + esc(relativeDay(o.placedAt)) + ' · ' + o.items.length + ' item' + (o.items.length === 1 ? '' : 's') + '</span></span></td>' +
        '<td class="cell-hide-sm"><span class="list-text"><span class="list-title">' + esc(o.customerName) + '</span><span class="list-subtitle">' + esc(o.customerEmail) + '</span></span></td>' +
        '<td class="cell-hide-sm"><span class="list-text"><span class="list-title">' + esc(o.recipientName) + '</span><span class="list-subtitle">' + esc(o.city) + '</span></span></td>' +
        '<td class="cell-inline num"><strong>' + money(o.total) + '</strong></td>' +
        '<td class="cell-inline">' + paymentLabel(o) + '</td>' +
        '<td class="cell-inline">' + statusLabel(o.status) + '</td>' +
        '<td class="cell-actions"><i class="bi bi-chevron-right" aria-hidden="true"></i></td>' +
      '</tr>';
    }).join('');
  }

  var orderModalEl = $('#order-modal');
  var orderModal = new bootstrap.Modal(orderModalEl);
  orderModalEl.addEventListener('hidden.bs.modal', function () { state.openOrderId = null; });

  function openOrder(id) {
    state.openOrderId = id;
    renderOrderSheet();
    orderModal.show();
  }

  function renderOrderSheet() {
    var o = state.orders.find(function (x) { return x.id === state.openOrderId; });
    if (!o) return;
    var info = flow.INFO[o.status];
    var reached = o.status === 'cancelled' ? -1 : flow.STEPS.indexOf(o.status);
    var next = flow.next(o.status);
    var titleCls = o.status === 'delivered' ? ' is-delivered' : o.status === 'cancelled' ? ' is-cancelled' : '';

    $('#order-modal-title').textContent = 'Order ' + o.orderNumber;

    var update = flow.isFinal(o.status)
      ? '<p class="final-note"><i class="bi bi-lock" aria-hidden="true"></i>This order is ' + esc(info.label.toLowerCase()) + ' and can no longer be updated.</p>'
      : '<div class="grouped-fields"><label for="order-note" class="visually-hidden">Message to the customer</label>' +
          '<textarea id="order-note" class="field-input field-textarea" rows="2" maxlength="200" placeholder="Optional message to the customer, for example: Driver Blessing is on the way."></textarea></div>' +
        '<p class="group-footnote">The customer sees the new step and this message in the app.</p>' +
        '<div class="update-actions">' +
          '<button type="button" class="btn btn-primary btn-lg" data-action="advance-order" data-id="' + esc(o.id) + '"><i class="bi ' + flow.INFO[next].icon + '" aria-hidden="true"></i>' + esc(flow.INFO[next].action) + '</button>' +
          '<button type="button" class="btn btn-plain btn-destructive" data-action="cancel-order" data-id="' + esc(o.id) + '"><i class="bi bi-x-circle" aria-hidden="true"></i>Cancel Order</button>' +
        '</div>';

    var items = o.items.map(function (i) {
      return '<div class="detail-line"><span>' + esc(i.name) + ' <span class="muted">x' + i.quantity + '</span></span><span class="num">' + money(i.price * i.quantity) + '</span></div>';
    }).join('');

    var history = o.history.slice().reverse().map(function (h) {
      return '<li><strong>' + esc(flow.INFO[h.status].label) + '</strong><div class="when">' +
        esc(new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</div>' +
        (h.note ? '<div class="note">' + esc(h.note) + '</div>' : '') + '</li>';
    }).join('');

    $('#order-body').innerHTML =
      '<p class="group-label">Status</p>' +
      '<div class="detail-card">' +
        '<p class="order-status-title' + titleCls + '"><i class="bi ' + info.icon + '" aria-hidden="true"></i>' + esc(info.label) + '</p>' +
        '<div class="order-steps' + (o.status === 'delivered' ? ' is-delivered' : '') + '" aria-hidden="true">' +
          flow.STEPS.map(function (s, i) { return '<span class="' + (i <= reached ? 'done' : '') + '"></span>'; }).join('') +
        '</div>' +
        '<p class="text-secondary-label small mb-0">Placed ' + esc(formatDate(o.placedAt)) + '</p>' +
      '</div>' +
      '<p class="group-label">Update progress</p>' + update +
      '<div class="row g-3 mt-1">' +
        '<div class="col-12 col-md-6">' +
          '<p class="group-label">Customer</p>' +
          '<div class="detail-card"><strong>' + esc(o.customerName) + '</strong><div class="text-secondary-label">' + esc(o.customerEmail) + '</div></div>' +
        '</div>' +
        '<div class="col-12 col-md-6">' +
          '<p class="group-label">Deliver to</p>' +
          '<div class="detail-card"><strong>' + esc(o.recipientName) + '</strong>' +
            '<div>' + esc(o.address) + (o.apartment ? ', ' + esc(o.apartment) : '') + ', ' + esc(o.city) + '</div>' +
            '<a class="phone-link" href="tel:' + esc(o.recipientPhone) + '"><i class="bi bi-telephone" aria-hidden="true"></i>' + esc(o.recipientPhone) + '</a>' +
            (o.instructions ? '<div class="text-secondary-label">Instructions: ' + esc(o.instructions) + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<p class="group-label">Items</p>' +
      '<div class="detail-card">' + items +
        '<div class="detail-line"><span class="muted">Delivery</span><span class="num">' + money(o.deliveryFee) + '</span></div>' +
        '<div class="detail-line detail-total"><span>Total</span><span class="num">' + money(o.total) + '</span></div>' +
      '</div>' +
      '<p class="group-label">Payment</p>' +
      '<div class="detail-card"><div class="detail-line"><span>' + esc(PAYMENT_METHOD[o.paymentMethod]) + '</span>' + paymentLabel(o) + '</div></div>' +
      '<p class="group-label">History</p>' +
      '<div class="detail-card"><ul class="history">' + history + '</ul></div>';
  }

  async function changeOrderStatus(id, status, button) {
    var noteEl = $('#order-note');
    var note = noteEl ? noteEl.value : '';
    if (button) setBusy(button, true, 'Updating…');
    try {
      var updated = await api.updateOrderStatus(id, status, note);
      state.orders = await api.listOrders();
      render();
      renderOrderSheet();
      // The re-render removed the focused button; keep focus inside the sheet so Escape and Tab still work.
      orderModalEl.focus();
      var refund = status === 'cancelled' && updated.paymentStatus === 'paid';
      notify(refund ? 'Order cancelled. Refund the customer.' : 'Customer notified: ' + flow.INFO[status].label);
    } catch (err) {
      handleError(err);
      if (button && document.body.contains(button)) setBusy(button, false);
    }
  }

  // Rows act like buttons for keyboard users too.
  document.addEventListener('keydown', function (e) {
    var row = e.target.closest && e.target.closest('.row-link');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); }
  });

  // ---------- products ----------

  var categoryFilter = $('#product-category-filter');
  function fillCategorySelects() {
    var options = api.categories.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
    categoryFilter.innerHTML = '<option value="all">All Categories</option>' + options;
    categoryFilter.value = state.productCategory;
    $('#product-category').innerHTML = '<option value="" disabled selected>Choose</option>' + options;
  }

  $('#product-search').addEventListener('input', function () { state.productQuery = this.value; renderProducts(); });
  categoryFilter.addEventListener('change', function () { state.productCategory = this.value; renderProducts(); });

  function renderProducts() {
    var words = state.productQuery.toLowerCase().split(/\s+/).filter(Boolean);
    var list = state.products.filter(function (p) {
      if (state.productCategory !== 'all' && p.categoryId !== state.productCategory) return false;
      var hay = (p.name + ' ' + p.description + ' ' + categoryName(p.categoryId)).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    }).sort(byNewest);

    $('#products-empty').hidden = list.length > 0;
    $('#product-grid').innerHTML = list.map(function (p) {
      var status = !p.visible
        ? '<span class="status status-off"><i class="bi bi-eye-slash" aria-hidden="true"></i>Hidden</span>'
        : p.stock === 0
          ? '<span class="status status-warn"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>Out of stock</span>'
          : '<span class="status status-ok"><i class="bi bi-check-circle" aria-hidden="true"></i>' + esc(p.stock) + ' in stock</span>';
      return '<article class="product-card' + (p.visible ? '' : ' is-hidden') + '">' +
        '<div class="product-media">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : '<i class="bi bi-image" aria-hidden="true"></i>') + '</div>' +
        '<div class="product-body"><div class="product-info">' +
          '<h3 class="product-name">' + esc(p.name) + '</h3>' +
          '<p class="product-meta">' + esc(categoryName(p.categoryId)) + '</p>' +
          '<p class="product-price">' + money(p.price) + '</p>' + status +
        '</div>' + productMenu(p) + '</div></article>';
    }).join('');
  }

  function productMenu(p) {
    return '<div class="dropdown">' +
      '<button type="button" class="icon-button icon-button-sm" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for ' + esc(p.name) + '"><i class="bi bi-three-dots" aria-hidden="true"></i></button>' +
      '<ul class="dropdown-menu dropdown-menu-end">' +
        '<li><button type="button" class="dropdown-item" data-action="edit-product" data-id="' + esc(p.id) + '"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</button></li>' +
        '<li><button type="button" class="dropdown-item" data-action="toggle-product" data-id="' + esc(p.id) + '"><i class="bi ' + (p.visible ? 'bi-eye-slash' : 'bi-eye') + '" aria-hidden="true"></i>' + (p.visible ? 'Hide from App' : 'Show in App') + '</button></li>' +
        '<li><hr class="dropdown-divider"></li>' +
        '<li><button type="button" class="dropdown-item destructive" data-action="delete-product" data-id="' + esc(p.id) + '"><i class="bi bi-trash" aria-hidden="true"></i>Delete</button></li>' +
      '</ul></div>';
  }

  // Product sheet

  var productModalEl = $('#product-modal');
  var productModal = new bootstrap.Modal(productModalEl);
  var productForm = $('#product-form');
  var productInputs = {
    name: $('#product-name'),
    price: $('#product-price'),
    categoryId: $('#product-category'),
    stock: $('#product-stock'),
    description: $('#product-description'),
    visible: $('#product-visible'),
  };

  function openProduct(product) {
    clearErrors(productForm);
    productForm.reset();
    state.pendingImage = undefined;
    $('#product-id').value = product ? product.id : '';
    $('#product-modal-title').textContent = product ? 'Edit Product' : 'New Product';
    productInputs.name.value = product ? product.name : '';
    productInputs.price.value = product ? Number(product.price).toFixed(2) : '';
    productInputs.categoryId.value = product ? product.categoryId : '';
    productInputs.stock.value = product ? String(product.stock) : '';
    productInputs.description.value = product ? product.description : '';
    productInputs.visible.checked = product ? product.visible : true;
    updateCounter();
    showImage(product ? product.image : null);
    productModal.show();
  }
  productModalEl.addEventListener('shown.bs.modal', function () { productInputs.name.focus(); });

  function updateCounter() { $('#desc-counter').textContent = productInputs.description.value.length + '/500'; }
  productInputs.description.addEventListener('input', updateCounter);

  // Image picking, validation and compression

  var imageInput = $('#image-input');
  var imageDrop = $('#image-drop');
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function showImage(src) {
    var img = $('#image-preview');
    img.hidden = !src;
    if (src) img.src = src; else img.removeAttribute('src');
    $('#image-empty').hidden = !!src;
    $('#image-actions').hidden = !src;
  }
  function pickImage() { imageInput.click(); }
  imageDrop.addEventListener('click', pickImage);
  imageDrop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickImage(); }
  });
  $('#image-change').addEventListener('click', pickImage);
  $('#image-remove').addEventListener('click', function () { releasePreview(); state.pendingImage = null; showImage(null); });
  function releasePreview() {
    if (state.pendingImage && state.pendingImage.url) URL.revokeObjectURL(state.pendingImage.url);
  }
  imageInput.addEventListener('change', function () {
    if (this.files[0]) acceptImage(this.files[0]);
    this.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (type) {
    imageDrop.addEventListener(type, function (e) { e.preventDefault(); imageDrop.classList.add('dragging'); });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    imageDrop.addEventListener(type, function (e) { e.preventDefault(); imageDrop.classList.remove('dragging'); });
  });
  imageDrop.addEventListener('drop', function (e) {
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) acceptImage(file);
  });

  async function acceptImage(file) {
    var errorEl = $('[data-error-for="image"]', productForm);
    errorEl.hidden = true;
    var problem = IMAGE_TYPES.indexOf(file.type) === -1 ? 'Choose a JPG, PNG or WebP image.'
      : file.size > MAX_IMAGE_BYTES ? 'This photo is larger than 5 MB.' : null;
    if (problem) {
      showErrors(productForm, { image: problem });
      return;
    }
    try {
      var blob = await compressImage(file, 1600, 0.85);
      releasePreview();
      state.pendingImage = { blob: blob, url: URL.createObjectURL(blob) };
      showImage(state.pendingImage.url);
    } catch (e) {
      showErrors(productForm, { image: 'This image could not be read. Try another file.' });
    }
  }

  // Resize to fit `maxSide` and re-encode as JPEG so uploads stay small on mobile data.
  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('encode')); }, 'image/jpeg', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  productForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors(productForm);
    var errors = {
      name: rules.productName(productInputs.name.value),
      price: rules.price(productInputs.price.value),
      stock: rules.stock(productInputs.stock.value),
      categoryId: productInputs.categoryId.value ? null : 'Choose a category.',
      description: rules.description(productInputs.description.value),
    };
    if (showErrors(productForm, errors, productInputs)) return;

    var id = $('#product-id').value;
    var existing = id && state.products.find(function (p) { return p.id === id; });
    var button = $('#product-save');
    setBusy(button, true, 'Saving…');
    try {
      await api.saveProduct({
        id: id || null,
        name: productInputs.name.value,
        price: Math.round(Number(productInputs.price.value) * 100) / 100,
        categoryId: productInputs.categoryId.value,
        stock: productInputs.stock.value.trim() ? Number(productInputs.stock.value) : 0,
        description: productInputs.description.value,
        visible: productInputs.visible.checked,
        imageBlob: state.pendingImage ? state.pendingImage.blob : null,
        removeImage: state.pendingImage === null && Boolean(existing && existing.image),
      });
      state.products = await api.listProducts();
      productModal.hide();
      render();
      notify(id ? 'Product updated' : 'Product added');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(button, false);
    }
  });

  // ---------- users ----------

  $('#user-search').addEventListener('input', function () { state.userQuery = this.value; renderUsers(); });
  $('#user-role-filter').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-role]');
    if (!btn) return;
    state.userRole = btn.dataset.role;
    $$('[data-role]', this).forEach(function (b) { b.setAttribute('aria-checked', String(b === btn)); });
    renderUsers();
  });

  function renderUsers() {
    var session = api.getSession() || {};
    var q = state.userQuery.trim().toLowerCase();
    var list = state.users.filter(function (u) {
      if (state.userRole !== 'all' && u.role !== state.userRole) return false;
      return !q || u.name.toLowerCase().indexOf(q) !== -1 || u.email.indexOf(q) !== -1;
    }).sort(byNewest);

    $('#users-empty').hidden = list.length > 0;
    $('#users-table-card').hidden = list.length === 0;
    $('#user-rows').innerHTML = list.map(function (u) {
      var isSelf = u.id === session.id;
      var provider = u.provider === 'google'
        ? '<span class="provider"><i class="bi bi-google" aria-hidden="true"></i>Google</span>'
        : '<span class="provider"><i class="bi bi-envelope" aria-hidden="true"></i>Email</span>';
      var status = u.status === 'active'
        ? '<span class="status status-ok"><i class="bi bi-check-circle" aria-hidden="true"></i>Active</span>'
        : '<span class="status status-off"><i class="bi bi-slash-circle" aria-hidden="true"></i>Suspended</span>';
      return '<tr>' +
        '<td><div class="user-cell"><span class="avatar" aria-hidden="true">' + esc(initials(u.name)) + '</span>' +
          '<span class="list-text"><span class="list-title">' + esc(u.name) + (isSelf ? ' <span class="text-secondary-label">(You)</span>' : '') + '</span>' +
          '<span class="list-subtitle">' + esc(u.email) + '</span></span></div></td>' +
        '<td class="cell-inline cell-indent"><span class="role-pill ' + (u.role === 'admin' ? 'role-admin' : '') + '">' + (u.role === 'admin' ? 'Admin' : 'Customer') + '</span></td>' +
        '<td class="cell-inline">' + provider + '</td>' +
        '<td class="cell-hide-sm">' + esc(formatDate(u.createdAt)) + '</td>' +
        '<td class="cell-inline">' + status + '</td>' +
        '<td class="cell-actions">' + userMenu(u, isSelf) + '</td>' +
      '</tr>';
    }).join('');
  }

  function userMenu(u, isSelf) {
    var suspendLabel = u.status === 'active' ? 'Suspend' : 'Reactivate';
    var suspendIcon = u.status === 'active' ? 'bi-slash-circle' : 'bi-arrow-counterclockwise';
    return '<div class="dropdown">' +
      '<button type="button" class="icon-button icon-button-sm" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for ' + esc(u.name) + '"><i class="bi bi-three-dots" aria-hidden="true"></i></button>' +
      '<ul class="dropdown-menu dropdown-menu-end">' +
        '<li><button type="button" class="dropdown-item" data-action="edit-user" data-id="' + esc(u.id) + '"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</button></li>' +
        '<li><button type="button" class="dropdown-item" data-action="suspend-user" data-id="' + esc(u.id) + '"' + (isSelf ? ' disabled' : '') + '><i class="bi ' + suspendIcon + '" aria-hidden="true"></i>' + suspendLabel + '</button></li>' +
        '<li><hr class="dropdown-divider"></li>' +
        '<li><button type="button" class="dropdown-item destructive" data-action="delete-user" data-id="' + esc(u.id) + '"' + (isSelf ? ' disabled' : '') + '><i class="bi bi-trash" aria-hidden="true"></i>Delete User</button></li>' +
      '</ul></div>';
  }

  // User sheet

  var userModalEl = $('#user-modal');
  var userModal = new bootstrap.Modal(userModalEl);
  var userForm = $('#user-form');
  var userInputs = {
    name: $('#user-name'),
    email: $('#user-email'),
    role: $('#user-role'),
    status: $('#user-status'),
    password: $('#user-password'),
  };

  function openUser(user) {
    clearErrors(userForm);
    userForm.reset();
    var editing = !!user;
    $('#user-id').value = editing ? user.id : '';
    $('#user-modal-title').textContent = editing ? 'Edit User' : 'New User';
    $('#user-save').textContent = editing ? 'Save' : 'Create';
    $('#user-save').dataset.label = $('#user-save').innerHTML;
    userInputs.name.value = editing ? user.name : '';
    userInputs.email.value = editing ? user.email : '';
    userInputs.email.readOnly = editing; // email changes need verification on the server
    userInputs.role.value = editing ? user.role : 'customer';
    userInputs.status.value = editing ? user.status : 'active';
    $('#user-status-row').hidden = !editing;
    $('#user-password-group').hidden = editing;
    userInputs.password.type = 'password';
    setPasswordToggle(false);
    userModal.show();
  }
  userModalEl.addEventListener('shown.bs.modal', function () { userInputs.name.focus(); });

  function setPasswordToggle(visible) {
    var btn = $('#toggle-password');
    btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    $('i', btn).className = visible ? 'bi bi-eye-slash' : 'bi bi-eye';
  }
  $('#toggle-password').addEventListener('click', function () {
    var show = userInputs.password.type === 'password';
    userInputs.password.type = show ? 'text' : 'password';
    setPasswordToggle(show);
  });
  $('#generate-password').addEventListener('click', function () {
    userInputs.password.value = generatePassword();
    userInputs.password.type = 'text';
    setPasswordToggle(true);
  });

  // 12 characters from an unambiguous alphabet, always with a letter and a digit.
  function generatePassword() {
    var letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    var digits = '23456789';
    var all = letters + digits;
    var bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    var chars = Array.prototype.map.call(bytes, function (b) { return all[b % all.length]; });
    chars[0] = letters[bytes[0] % letters.length];
    chars[11] = digits[bytes[11] % digits.length];
    return chars.join('');
  }

  userForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors(userForm);
    var id = $('#user-id').value;
    var errors = { name: rules.personName(userInputs.name.value) };
    if (!id) {
      errors.email = rules.email(userInputs.email.value);
      errors.password = rules.password(userInputs.password.value);
    }
    if (showErrors(userForm, errors, userInputs)) return;

    var button = $('#user-save');
    setBusy(button, true, id ? 'Saving…' : 'Creating…');
    try {
      if (id) {
        await api.updateUser(id, { name: userInputs.name.value, role: userInputs.role.value, status: userInputs.status.value });
      } else {
        await api.createUser({ name: userInputs.name.value, email: userInputs.email.value, role: userInputs.role.value, password: userInputs.password.value });
      }
      state.users = await api.listUsers();
      var session = api.getSession();
      if (session) $$('[data-admin-name]').forEach(function (el) { el.textContent = session.name; });
      userModal.hide();
      render();
      notify(id ? 'User updated' : 'User created');
    } catch (err) {
      if (err.code === 'email_taken') showErrors(userForm, { email: err.message }, userInputs);
      else if (err.code === 'last_admin' || err.code === 'self') showErrors(userForm, { role: err.message }, userInputs);
      else handleError(err);
    } finally {
      setBusy(button, false);
    }
  });

  // ---------- row actions ----------

  document.addEventListener('click', async function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    var id = target.dataset.id;
    var product = id && state.products.find(function (p) { return p.id === id; });
    var user = id && state.users.find(function (u) { return u.id === id; });

    try {
      if (action === 'open-order') openOrder(id);

      if (action === 'advance-order') {
        var current = state.orders.find(function (o) { return o.id === id; });
        if (current && flow.next(current.status)) await changeOrderStatus(id, flow.next(current.status), target);
      }

      if (action === 'cancel-order') {
        var toCancel = state.orders.find(function (o) { return o.id === id; });
        if (!toCancel) return;
        var okC = await confirmDestructive('Cancel order ' + toCancel.orderNumber + '?', 'The customer will see that their order was cancelled. You can\'t undo this action.', 'Cancel Order', 'Keep Order');
        if (okC) await changeOrderStatus(id, 'cancelled', null);
      }

      if (action === 'new-product') openProduct(null);
      if (action === 'edit-product' && product) openProduct(product);
      if (action === 'new-user') openUser(null);
      if (action === 'edit-user' && user) openUser(user);

      if (action === 'toggle-product' && product) {
        await api.saveProduct(Object.assign({}, product, { visible: !product.visible }));
        state.products = await api.listProducts();
        render();
        notify(product.visible ? 'Hidden from the app' : 'Now showing in the app');
      }

      if (action === 'delete-product' && product) {
        var okP = await confirmDestructive('Delete "' + product.name + '"?', 'This product will be removed from the app. You can\'t undo this action.', 'Delete');
        if (!okP) return;
        await api.deleteProduct(product.id);
        state.products = await api.listProducts();
        render();
        notify('Product deleted');
      }

      if (action === 'suspend-user' && user) {
        await api.updateUser(user.id, { name: user.name, role: user.role, status: user.status === 'active' ? 'suspended' : 'active' });
        state.users = await api.listUsers();
        render();
        notify(user.status === 'active' ? user.name + ' is suspended' : user.name + ' is active again');
      }

      if (action === 'delete-user' && user) {
        var okU = await confirmDestructive('Delete ' + user.name + '?', 'Their account, profile and saved details will be permanently deleted. You can\'t undo this action.', 'Delete');
        if (!okU) return;
        await api.deleteUser(user.id);
        state.users = await api.listUsers();
        render();
        notify('User deleted');
      }
    } catch (err) {
      handleError(err);
    }
  });

  productForm.addEventListener('input', clearFieldError);
  productForm.addEventListener('change', clearFieldError);
  userForm.addEventListener('input', clearFieldError);
  userForm.addEventListener('change', clearFieldError);

  // ---------- start ----------

  (async function start() {
    try {
      var restored = await api.loadSession();
      if (restored) showApp(restored);
      else showLogin();
    } catch (err) {
      showLogin();
      $('#login-error').textContent = err.message;
      $('#login-error').hidden = false;
    }
  })();
})();
