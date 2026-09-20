/**
 * site.js — the only script on the marketing pages.
 *
 * Two jobs: relay a theme toggle into each demo iframe, and reflect what the
 * demo reports back into its status chip. Everything else on the site works
 * with JavaScript off.
 */
(function () {
  'use strict';

  var themes = {};

  document.querySelectorAll('[data-demo-theme]').forEach(function (btn) {
    var id = btn.getAttribute('data-demo-theme'),
        frame = document.querySelector('[data-demo-frame="' + id + '"]');
    if (!frame) { return; }

    btn.addEventListener('click', function () {
      themes[id] = themes[id] === 'light' ? 'dark' : 'light';
      frame.contentWindow.postMessage({ setTheme: themes[id] }, '*');
    });
  });

  // Seed each toggle from the theme the frame was generated with, so the first
  // click flips rather than re-applying what is already on screen.
  document.querySelectorAll('[data-demo-frame]').forEach(function (frame) {
    themes[frame.getAttribute('data-demo-frame')] = null;
  });

  window.addEventListener('message', function (ev) {
    if (!ev.data || !ev.data.demo) { return; }
    var chip = document.querySelector('[data-demo-status="' + ev.data.demo + '"]');
    if (!chip) { return; }
    if (ev.data.status === 'error') {
      chip.classList.add('is-error');
      chip.lastChild.nodeValue = 'Demo unavailable';
    }
  });
}());
