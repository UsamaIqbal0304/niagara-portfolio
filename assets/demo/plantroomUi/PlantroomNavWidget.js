/**
 * Plantroom Labs navigation for Niagara 4 PX graphics.
 *
 * The icon rail plus its submenu panel, as one WebWidget. They are one widget
 * on purpose: selecting a rail section changes the submenu's whole contents, so
 * splitting them would mean cross-widget state on a page that has no state
 * manager. It also keeps the JACE-8000 serving two JS files for this library
 * rather than four.
 *
 * Drop it on a PX view as a wb:WebWidget with
 *   js         = view:plantroomUi:PlantroomNavWidget
 *   fileConfig = file:^plantroomUi/nav.json
 *
 * Navigation model, in priority order:
 *   1. entry has an `ord`  -> navigate the browser to that station view
 *   2. otherwise           -> emit a `plantroomui:navigate` CustomEvent on window,
 *                             which PlantroomDashboardWidget listens for
 * so the same widget works whether the sheet is a set of linked PX views or a
 * single view with a live-updating stage.
 *
 * @module nmodule/plantroomUi/rc/PlantroomNavWidget
 */
define([
  'bajaux/Widget',
  'bajaux/mixin/subscriberMixIn',
  'baja!',
  'Promise',
  'css!nmodule/plantroomUi/rc/PlantroomStyle'
], function (Widget, subscriberMixIn, baja, Promise) {
  'use strict';

  /** PX-editable properties — these are the WebWidget property sheet. */
  function widgetDefaults() {
    return {
      properties: {
        config: '',
        fileConfig: '',
        cssOverride: '',
        theme: 'light',
        accentColor: '#7b61ff',
        activeColor: '#252a31',
        showTooltips: true,
        tooltipDelay: 220,
        section: '',
        floor: ''
      }
    };
  }

  /* --------------------------------------------------------------- icons
     One stroke weight, one cap style, one 24x24 box, paths only — colour and
     size come from whatever draws them. */
  var ICONS = {
    site:      'M3 21h18M5 21V9l7-5 7 5v12M9.5 21v-5h5v5M9.5 12h.01M14.5 12h.01',
    floors:    'M3 8.5 12 3l9 5.5-9 5.5zM3 12.5 12 18l9-5.5M3 16.5 12 22l9-5.5',
    water:     'M12 3s6.5 6.9 6.5 11.2A6.5 6.5 0 0 1 5.5 14.2C5.5 9.9 12 3 12 3z',
    cooling:   'M12 2v20M4.2 6.5l15.6 9M19.8 6.5 4.2 15.5M12 6l-2.4-2.4M12 6l2.4-2.4M12 18l-2.4 2.4M12 18l2.4 2.4',
    heating:   'M12 22c3.3 0 6-2.6 6-5.8 0-4.4-6-13.2-6-13.2S6 11.8 6 16.2C6 19.4 8.7 22 12 22z M12 18.5c1.1 0 2-.9 2-2 0-1.4-2-4-2-4s-2 2.6-2 4c0 1.1.9 2 2 2z',
    vent:      'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12c3.3 0 6 1.3 6 3s-2.7 3-6 3M12 12c-2.4 2.3-3.8 4.8-2.7 6.2 1.1 1.3 4 .5 6.4-1.8M12 12C9.6 9.7 8.6 7 10 5.9c1.4-1.1 4 .3 5.6 3',
    power:     'M13 2 4 14h7l-1 8 9-12h-7z',
    lighting:  'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.2.9 2H14.7c0-.8.3-1.5.9-2A6 6 0 0 0 12 3z',
    security:  'M12 3l7.5 3v6c0 4.4-3.1 8.4-7.5 9.6C7.6 20.4 4.5 16.4 4.5 12V6z M9.3 12.2l1.9 1.9 3.5-3.6',
    energy:    'M3 20h18M6 20V11M10.5 20V6M15 20v-9M19.5 20V8',
    analytics: 'M4 4v16h16M7.5 15.5 11 11l3 2.6 4.5-6.2M18.5 7.4h-3.2M18.5 7.4v3.2',
    chevron:   'M9.5 6.5l5.5 5.5-5.5 5.5',
    logout:    'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',
    grid:      'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'
  };

  function icon(name, cls) {
    return '<span class="' + (cls || '') + '"><svg viewBox="0 0 24 24" aria-hidden="true">' +
           '<path d="' + (ICONS[name] || ICONS.grid) + '"/></svg></span>';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --------------------------------------------------------------- widget */

  var PlantroomNavWidget = function PlantroomNavWidget(params) {
    Widget.call(this, { params: params, defaults: widgetDefaults() });
    subscriberMixIn(this);
    this.$cfg = { nav: [], floors: [] };
    this.$state = { section: null, entry: null, floor: null, open: {} };
  };

  PlantroomNavWidget.prototype = Object.create(Widget.prototype);
  PlantroomNavWidget.prototype.constructor = PlantroomNavWidget;

  /** fileConfig ORD wins over the inline config string. */
  PlantroomNavWidget.prototype.$resolveConfig = function () {
    var props = this.properties(),
        fileOrd = String(props.getValue('fileConfig') || '').trim(),
        inline = String(props.getValue('config') || '').trim();

    function parse(text) {
      try { return JSON.parse(text); }
      catch (e) { return { $error: 'nav config is not valid JSON: ' + e.message }; }
    }
    if (fileOrd) {
      return baja.Ord.make(fileOrd).get()
        .then(function (f) { return f.readText ? f.readText() : String(f); })
        .then(parse)
        .catch(function (err) { return { $error: 'could not read ' + fileOrd + ': ' + err.message }; });
    }
    return Promise.resolve(inline ? parse(inline) : { nav: [], floors: [] });
  };

  PlantroomNavWidget.prototype.doInitialize = function (dom) {
    var that = this;
    that.$dom = dom;
    return that.$resolveConfig().then(function (cfg) {
      that.$cfg = cfg || { nav: [], floors: [] };
      var props = that.properties(),
          first = (that.$cfg.nav || [])[0];
      that.$state.section = String(props.getValue('section') || '') || (first && first.id) || null;
      that.$state.floor = String(props.getValue('floor') || '') || (that.$cfg.floors || [])[0] || null;
      that.$syncEntry();
      that.$render();
    });
  };

  PlantroomNavWidget.prototype.doLoad = function () {
    if (this.$dom) { this.$render(); }
    return Promise.resolve();
  };

  PlantroomNavWidget.prototype.$section = function () {
    var id = this.$state.section, list = this.$cfg.nav || [], i;
    for (i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0] || null;
  };

  /** Keep the selected entry inside the selected section. */
  PlantroomNavWidget.prototype.$syncEntry = function () {
    var s = this.$section();
    if (s && s.sub && s.sub.groups && s.sub.groups.length) {
      var first = s.sub.groups[0].items[0];
      this.$state.entry = first ? first.id : null;
    } else {
      this.$state.entry = null;
    }
  };

  /* ------------------------------------------------------------------ html */

  PlantroomNavWidget.prototype.$render = function () {
    var that = this,
        props = that.properties(),
        cfg = that.$cfg,
        host = that.$dom[0] || that.$dom;

    if (cfg.$error) {
      host.innerHTML = '<pre style="color:#e53935;font:12px monospace;padding:12px">' +
                       esc(cfg.$error) + '</pre>';
      return;
    }

    var root = document.createElement('div');
    root.className = 'plu-root gx-mesh';
    root.setAttribute('data-theme', props.getValue('theme') === 'dark' ? 'dark' : 'light');
    root.style.setProperty('--gx-run', props.getValue('accentColor'));
    root.style.setProperty('--gx-n-95', props.getValue('activeColor'));

    root.innerHTML =
      '<div class="gx-app" style="grid-template-columns:var(--gx-rail-w) auto">' +
        that.$railHtml() + that.$subHtml() +
      '</div>' +
      '<div class="gx-tip" data-tip></div>';

    host.innerHTML = '';
    host.appendChild(root);

    var css = String(props.getValue('cssOverride') || '');
    if (css) {
      var st = document.createElement('style');
      st.textContent = css;
      root.appendChild(st);
    }

    that.$root = root;
    that.$wire(root);
  };

  PlantroomNavWidget.prototype.$railHtml = function () {
    var that = this, cfg = this.$cfg, brand = cfg.brand || {};
    return '<nav class="gx-rail" aria-label="Systems">' +
      '<div class="gx-rail__brand">' +
        '<span class="gx-rail__mark">' + icon(brand.icon || 'site') + '</span>' +
        '<span class="gx-rail__wordmark">' + esc(brand.name || 'Plantroom Labs') + '</span>' +
      '</div>' +
      '<div class="gx-rail__nav" data-rail>' +
        (cfg.nav || []).map(function (s) {
          var tip = s.tip || {},
              hasSub = !!(s.sub || s.kind === 'floors');
          return '<div class="gx-rail__item' + (hasSub ? ' has-sub' : '') +
                 (s.id === that.$state.section ? ' is-current' : '') + '"' +
                 ' data-section="' + esc(s.id) + '"' +
                 ' data-tip-title="' + esc(tip.title || s.label) + '"' +
                 ' data-tip-meta="' + esc(tip.meta || '') + '"' +
                 ' data-tip-state="' + esc(tip.state || 'ok') + '">' +
                   '<button class="gx-rail__btn" type="button" aria-label="' +
                     esc(tip.title || s.label) + '" aria-current="' +
                     (s.id === that.$state.section) + '">' +
                     icon(s.icon, 'gx-rail__icon') +
                     '<span class="gx-rail__label">' + esc(s.label) + '</span>' +
                   '</button>' +
                 '</div>';
        }).join('') +
      '</div>' +
      (cfg.showLogout === false ? '' :
        '<div class="gx-rail__foot">' +
          '<button class="gx-btn gx-btn--ghost gx-btn--icon" type="button" ' +
          'data-logout aria-label="Sign out">' + icon('logout') + '</button>' +
        '</div>') +
    '</nav>';
  };

  PlantroomNavWidget.prototype.$subHtml = function () {
    var s = this.$section(), that = this;
    if (!s) { return '<aside class="gx-sub is-empty"></aside>'; }

    if (s.kind === 'floors') {
      var floors = this.$cfg.floors || [];
      return '<aside class="gx-sub" aria-label="Select floor">' +
        '<div class="gx-sub__head"><span class="gx-sub__title">Select Floor</span>' +
        '<span class="gx-sub__count">' + floors.length + '</span></div>' +
        '<div class="gx-floors">' + floors.map(function (f) {
          return '<button class="gx-floor' + (f === that.$state.floor ? ' is-active' : '') +
                 '" type="button" data-floor="' + esc(f) + '">' + esc(f) + '</button>';
        }).join('') + '</div></aside>';
    }

    if (!s.sub) { return '<aside class="gx-sub is-empty"></aside>'; }

    var count = 0;
    s.sub.groups.forEach(function (g) { count += g.items.length; });

    return '<aside class="gx-sub" aria-label="' + esc(s.sub.title || s.label) + '">' +
      '<div class="gx-sub__head"><span class="gx-sub__title">' +
        esc(s.sub.title || s.label) + '</span>' +
      '<span class="gx-sub__count">' + count + '</span></div>' +
      '<div class="gx-sub__list">' +
        s.sub.groups.map(function (g) {
          return '<div class="gx-sub__group">' +
            '<div class="gx-sub__group-label gx-eyebrow">' + esc(g.label) + '</div>' +
            g.items.map(function (it) { return that.$itemHtml(it); }).join('') +
          '</div>';
        }).join('') +
      '</div></aside>';
  };

  PlantroomNavWidget.prototype.$itemHtml = function (it) {
    var that = this,
        active = it.id === this.$state.entry,
        meta = it.meta
          ? (it.state
              ? '<span class="gx-chip gx-chip--soft is-' + esc(it.state) + '">' + esc(it.meta) + '</span>'
              : '<span class="gx-sub__link-meta">' + esc(it.meta) + '</span>')
          : '';

    function link(node, isActive, extra) {
      return '<button class="gx-sub__link' + (isActive ? ' is-active' : '') + '" type="button"' +
             ' data-entry="' + esc(node.id) + '"' +
             (node.ord ? ' data-ord="' + esc(node.ord) + '"' : '') +
             (extra || '') + '>' +
             (node.children ? icon('chevron', 'gx-sub__caret') : '') +
             '<span class="gx-sub__link-text">' + esc(node.label) + '</span>' +
             (node === it ? meta : (node.state
               ? '<span class="gx-chip gx-chip--soft is-' + esc(node.state) + '">' + esc(node.meta || node.state) + '</span>'
               : '')) +
             '</button>';
    }

    if (!it.children) { return link(it, active); }

    var open = !!this.$state.open[it.id];
    return '<div class="gx-sub__branch' + (open ? ' is-open' : '') + '" data-branch="' + esc(it.id) + '">' +
      link(it, active, ' data-toggle="' + esc(it.id) + '"') +
      '<div class="gx-sub__children">' +
        it.children.map(function (c) {
          return '<button class="gx-sub__link' + (c.id === that.$state.entry ? ' is-active' : '') +
                 '" type="button" data-entry="' + esc(c.id) + '"' +
                 (c.ord ? ' data-ord="' + esc(c.ord) + '"' : '') + '>' +
                 '<span class="gx-sub__link-text">' + esc(c.label) + '</span>' +
                 (c.state ? '<span class="gx-chip gx-chip--soft is-' + esc(c.state) + '">' +
                            esc(c.meta || c.state) + '</span>' : '') +
                 '</button>';
        }).join('') +
      '</div></div>';
  };

  /* ---------------------------------------------------------- interaction */

  PlantroomNavWidget.prototype.$wire = function (root) {
    var that = this,
        rail = root.querySelector('[data-rail]'),
        tip = root.querySelector('[data-tip]'),
        timer = null;

    /* Tooltips. One element, moved to the hovered item and positioned relative
       to the widget root — the rail scrolls, and a scroll container computes
       overflow-x as auto, which would clip a tooltip parented to the item. */
    function showTip(item, immediate) {
      if (!that.properties().getValue('showTooltips')) { return; }
      clearTimeout(timer);
      var run = function () {
        var meta = item.getAttribute('data-tip-meta'),
            st = item.getAttribute('data-tip-state'),
            r = item.getBoundingClientRect(),
            rr = root.getBoundingClientRect();
        tip.innerHTML =
          '<div class="gx-tip__title">' + esc(item.getAttribute('data-tip-title')) + '</div>' +
          (meta ? '<div class="gx-tip__meta"><span class="gx-tip__dot' +
                    (st === 'bad' ? ' gx-tip__dot--bad' : st === 'run' ? ' gx-tip__dot--run' : '') +
                  '"></span><span>' + esc(meta) + '</span></div>' : '');
        tip.style.left = (r.right - rr.left + 10) + 'px';
        tip.style.top = (r.top - rr.top + r.height / 2) + 'px';
        tip.classList.add('is-on');
      };
      if (immediate) { run(); }
      else { timer = setTimeout(run, Number(that.properties().getValue('tooltipDelay')) || 220); }
    }
    function hideTip() { clearTimeout(timer); tip.classList.remove('is-on'); }

    if (rail) {
      rail.addEventListener('mouseover', function (e) {
        var item = e.target.closest('.gx-rail__item');
        if (item) { showTip(item, false); }
      });
      rail.addEventListener('mouseout', function (e) {
        if (!e.relatedTarget || !e.relatedTarget.closest('.gx-rail__item')) { hideTip(); }
      });
      rail.addEventListener('focusin', function (e) {
        var item = e.target.closest('.gx-rail__item');
        if (item) { showTip(item, true); }
      });
      rail.addEventListener('focusout', hideTip);
      rail.addEventListener('scroll', hideTip);
    }

    root.addEventListener('click', function (e) {
      var railItem = e.target.closest('.gx-rail__item'),
          floor = e.target.closest('[data-floor]'),
          link = e.target.closest('[data-entry]');

      if (railItem) {
        hideTip();
        if (railItem.getAttribute('data-section') !== that.$state.section) {
          that.$state.section = railItem.getAttribute('data-section');
          that.$syncEntry();
          that.$render();
          that.$publish();
        }
        return;
      }
      if (floor) {
        that.$state.floor = floor.getAttribute('data-floor');
        that.$render();
        that.$publish();
        return;
      }
      if (link) {
        var toggle = link.getAttribute('data-toggle');
        if (toggle) { that.$state.open[toggle] = !that.$state.open[toggle]; }
        that.$state.entry = link.getAttribute('data-entry');
        that.$render();
        var ord = link.getAttribute('data-ord');
        if (ord) { that.$navigate(ord); } else { that.$publish(); }
      }
    });
  };

  /**
   * Tell the rest of the sheet where we are. PlantroomDashboardWidget listens for
   * this; anything else on the page may too.
   */
  PlantroomNavWidget.prototype.$publish = function () {
    var s = this.$section();
    try {
      window.dispatchEvent(new CustomEvent('plantroomui:navigate', {
        detail: {
          section: this.$state.section,
          sectionLabel: s ? s.label : '',
          entry: this.$state.entry,
          floor: this.$state.floor
        }
      }));
    } catch (e) { /* older engines without CustomEvent: navigation still works by ORD */ }
  };

  /** Browser profile serves station views under /ord/. */
  PlantroomNavWidget.prototype.$navigate = function (ord) {
    if (!ord) { return; }
    var url = ord.indexOf('/') === 0 ? ord : '/ord/' + encodeURIComponent(ord).replace(/%3A/g, ':');
    window.location.href = url;
  };

  PlantroomNavWidget.prototype.doDestroy = function () {
    if (this.$dom) { (this.$dom[0] || this.$dom).innerHTML = ''; }
    return Promise.resolve();
  };

  return PlantroomNavWidget;
});
