/**
 * site.js — the only script on the marketing pages.
 *
 * Three jobs: relay a theme toggle into each demo iframe, reflect what the
 * demo reports back into its status chip, and track which section the landing
 * page is scrolled to so the header can mark it. Everything else on the site
 * works with JavaScript off, and the header degrades to plain anchor links
 * that still jump to the right place.
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

  // ------------------------------------------------------------ section spy
  // On the landing page the header is also the section bar: its links point
  // at sections, and this marks the one you are in and slides the ink bar to
  // it. One row, not two.
  //
  // Deliberately not IntersectionObserver: these sections are taller than
  // the viewport, so more than one is intersecting most of the time and
  // "which am I in" still has to be decided by position. Reading scroll
  // position directly answers it once, and is cheap enough inside rAF.
  (function sectionSpy() {
    var bar = document.querySelector('.pl-nav--tabs');
    if (!bar) { return; }

    var ink = bar.querySelector('.pl-nav__ink'),
        list = bar.querySelector('.pl-nav__links'),
        links = [].slice.call(bar.querySelectorAll('[data-tab]')),
        current = null,
        queued = false;

    var targets = links.map(function (a) {
      return { link: a, el: document.getElementById(a.getAttribute('data-tab')) };
    }).filter(function (t) { return t.el; });

    if (!ink || !targets.length) { return; }

    function moveInk(a) {
      // A link dropped at this width has no box to point at, so leave the
      // ink where it is rather than collapsing it onto the left edge.
      if (!a.offsetParent) { ink.classList.remove('is-on'); return; }
      ink.style.width = a.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + (a.offsetLeft - list.scrollLeft) + 'px)';
      ink.classList.add('is-on');
    }

    function select(t) {
      if (t === current) { return; }
      if (current) { current.link.removeAttribute('aria-current'); }
      current = t;
      t.link.setAttribute('aria-current', 'true');
      moveInk(t.link);
    }

    function update() {
      queued = false;
      // A section becomes current once its top passes a line set a little
      // below the header, rather than exactly at it. Two reasons: it reads
      // better, activating as a section arrives instead of once its heading
      // is already gone; and clicking a link leaves the section a short
      // distance below the bar, which an exact line would score as still
      // being in the previous section.
      var box = bar.getBoundingClientRect(),
          line = box.bottom + (window.innerHeight - box.bottom) * 0.25,
          found = targets[0];

      for (var i = 0; i < targets.length; i++) {
        if (targets[i].el.getBoundingClientRect().top <= line) { found = targets[i]; }
      }

      // At the very bottom the last section may never reach the line — if
      // the page cannot scroll further, it is the one you are on.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        found = targets[targets.length - 1];
      }
      select(found);
    }

    function onScroll() {
      if (queued) { return; }
      queued = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      if (current) { moveInk(current.link); }
      onScroll();
    });

    // Fonts land after first paint and change link widths under the ink.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (current) { moveInk(current.link); } });
    }

    update();
  }());
}());
