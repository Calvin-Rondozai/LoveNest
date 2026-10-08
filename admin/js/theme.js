// Follow the system light/dark appearance before first paint (kept out of the HTML for the CSP).
(function () {
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var apply = function () { document.documentElement.setAttribute('data-bs-theme', mq.matches ? 'dark' : 'light'); };
  apply();
  mq.addEventListener('change', apply);
})();
