// Follow the system light/dark appearance before first paint (kept out of the HTML for the CSP).
(function () {
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var apply = function () {
    var theme = mq.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.documentElement.style.colorScheme = theme;
  };
  apply();
  mq.addEventListener('change', apply);
})();
