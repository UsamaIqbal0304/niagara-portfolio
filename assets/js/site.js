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

  // Each control sets a real widget property inside the frame, the way a PX
  // author would set it, and then reflects the state that produced. A button
  // is only rendered where the widget declares the property behind it, so
  // there is no control here that cannot change anything.
  document.querySelectorAll('[data-demo-theme]').forEach(function (btn) {
    var id = btn.getAttribute('data-demo-theme'),
        frame = document.querySelector('[data-demo-frame="' + id + '"]');
    if (!frame) { btn.parentNode.removeChild(btn); return; }

    // Seeded from the theme the frame was generated with, so the first click
    // flips rather than re-applying what is already on screen.
    themes[id] = btn.getAttribute('data-theme-init');

    btn.addEventListener('click', function () {
      themes[id] = themes[id] === 'light' ? 'dark' : 'light';
      btn.setAttribute('aria-pressed', themes[id] === 'dark' ? 'true' : 'false');
      frame.contentWindow.postMessage({ setTheme: themes[id] }, '*');
    });
  });

  document.querySelectorAll('[data-demo-ords]').forEach(function (btn) {
    var id = btn.getAttribute('data-demo-ords'),
        frame = document.querySelector('[data-demo-frame="' + id + '"]');
    if (!frame) { btn.parentNode.removeChild(btn); return; }

    btn.textContent = btn.getAttribute('aria-pressed') === 'true' ? 'Hide ORDs' : 'Show ORDs';

    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Hide ORDs' : 'Show ORDs';
      frame.contentWindow.postMessage({ setProps: { showOrds: on } }, '*');
    });
  });

  window.addEventListener('message', function (ev) {
    if (!ev.data || !ev.data.demo) { return; }

    // The frame reports the height its widget actually needs. Without this the
    // CSS height is a guess, and a guess that is 70px short leaves the bottom
    // row of a dashboard behind an internal scrollbar nobody uses.
    //
    // Only ever grow. The widget stretches to fill whatever it is given, so a
    // height that shrinks feeds straight back into the next measurement and
    // the frame oscillates; growing to the tallest request converges instead.
    // Capped so a runaway widget cannot own the whole page.
    if (typeof ev.data.height === 'number' && ev.data.height > 0) {
      var frame = document.querySelector('[data-demo-frame="' + ev.data.demo + '"][data-demo-fit]'),
          box = frame && frame.closest('.pl-demo__frame');
      if (box) {
        var want = Math.max(280, Math.min(1400, Math.ceil(ev.data.height))),
            have = parseInt(box.style.getPropertyValue('--demo-h'), 10) || 0;
        if (want > have) { box.style.setProperty('--demo-h', want + 'px'); }
      }
    }

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

  // ------------------------------------------------------- narrow-screen menu
  // The <details> opens and closes on its own. All this adds is the two ways
  // people expect to dismiss an open menu without choosing anything from it.
  (function () {
    var menu = document.querySelector('[data-menu]');
    if (!menu) { return; }

    function close() {
      if (menu.open) { menu.open = false; }
    }

    document.addEventListener('click', function (ev) {
      if (menu.open && !menu.contains(ev.target)) { close(); }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !menu.open) { return; }
      close();
      var summary = menu.querySelector('summary');
      if (summary) { summary.focus(); }
    });
  }());
}());
