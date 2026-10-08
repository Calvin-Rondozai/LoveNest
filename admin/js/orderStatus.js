/*
 * Order lifecycle. Mirrors src/data/orderStatus.ts in the mobile app (and the server).
 * Keep them in sync: same keys, same order, same customer messages.
 */
(function () {
  'use strict';

  var STEPS = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

  var INFO = {
    placed: { label: 'Order placed', icon: 'bi-receipt', action: null, customerMessage: 'We have received your order.' },
    confirmed: { label: 'Confirmed', icon: 'bi-check-circle', action: 'Confirm Order', customerMessage: 'Your order is confirmed.' },
    preparing: { label: 'Being prepared', icon: 'bi-gift', action: 'Start Preparing', customerMessage: 'We are preparing and wrapping your gift.' },
    out_for_delivery: { label: 'Out for delivery', icon: 'bi-bicycle', action: 'Send Out for Delivery', customerMessage: 'Your gift is on its way.' },
    delivered: { label: 'Delivered', icon: 'bi-house-check', action: 'Mark as Delivered', customerMessage: 'Your gift has been delivered.' },
    cancelled: { label: 'Cancelled', icon: 'bi-x-circle', action: null, customerMessage: 'Your order was cancelled.' },
  };

  function isFinal(status) { return status === 'delivered' || status === 'cancelled'; }
  function next(status) {
    var i = STEPS.indexOf(status);
    return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
  }

  window.OrderStatus = { STEPS: STEPS, INFO: INFO, isFinal: isFinal, next: next };
})();
