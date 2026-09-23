/**
 * RocketGX dashboard stage for Niagara 4 PX graphics.
 *
 * The top bar plus the block grid: KPI tiles, value rows with edit/open
 * actions, two-column plant-monitoring lists, callouts, an equipment table, and
 * plant schematics whose symbols and pipe readings are bound points.
 *
 * Every block that shows a reading declares an `ord`. Values arrive through the
 * standard bajaux subscriber mix-in, so the same file runs against a live
 * station; offline, unresolved ORDs leave the design-time value in place, which
 * is what the PX editor shows at engineering time anyway.
 *
 * Listens for `rocketgx:navigate` from RocketGxNavWidget so the heading follows
 * the rail without either widget knowing about the other's internals.
 *
 * @module nmodule/rocketGx/rc/RocketGxDashboardWidget
 */
define([
  'bajaux/Widget',
  'bajaux/mixin/subscriberMixIn',
  'baja!',
  'Promise',
  'css!nmodule/rocketGx/rc/RocketGxStyle'
], function (Widget, subscriberMixIn, baja, Promise) {
  'use strict';

  function widgetDefaults() {
    return {
      properties: {
        config: '',
        fileConfig: '',
        cssOverride: '',
        theme: 'light',
        accentColor: '#7b61ff',
        showTopBar: true,
        showOrds: false,
        site: '',
        heading: ''
      }
    };
  }

  var ICONS = {
    back:    'M15 6l-6 6 6 6',
    fwd:     'M9 6l6 6-6 6',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
    info:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.6h.01',
    edit:    'M15.5 5.5l3 3M4 20l1-4L16 5a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L8 19z',
    open:    'M8 16 16 8M9.5 8H16v6.5',
    cloud:   'M7 18h9.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 18z',
    power:   'M13 2 4 14h7l-1 8 9-12h-7z',
    cooling: 'M12 2v20M4.2 6.5l15.6 9M19.8 6.5 4.2 15.5',
    heating: 'M12 22c3.3 0 6-2.6 6-5.8 0-4.4-6-13.2-6-13.2S6 11.8 6 16.2C6 19.4 8.7 22 12 22z',
    bell:    'M18 15.5V10a6 6 0 1 0-12 0v5.5L4.4 18h15.2zM10 20.5a2 2 0 0 0 4 0',
    pump:    'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 15h.01M12 9V4h5M6 12H3M18 5.5l2.5-2',
    temp:    'M13.5 14.6V5a2 2 0 1 0-4 0v9.6a4 4 0 1 0 4 0z',
    co2:     'M7 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10.5 8.3l3.8-2.1M10.5 11.7l3.8 2.1',
    boiler:  'M6 3h12v18H6zM9 7h6M9 11h6M10.5 15.5h3',
    meter:   'M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 12l3.5-3.5',
    grid:    'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'
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
  function chip(label, state, solid, id) {
    return '<span class="gx-chip gx-chip--' + (solid ? 'solid' : 'soft') +
           ' is-' + esc(state) + '"' + (id ? ' data-point="' + esc(id) + '"' : '') +
           '>' + esc(label) + '</span>';
  }

  /* --------------------------------------------------------------- widget */

  var RocketGxDashboardWidget = function RocketGxDashboardWidget(params) {
    Widget.call(this, { params: params, defaults: widgetDefaults() });
    subscriberMixIn(this);
    this.$cfg = { blocks: [] };
    this.$nav = null;
  };

  RocketGxDashboardWidget.prototype = Object.create(Widget.prototype);
  RocketGxDashboardWidget.prototype.constructor = RocketGxDashboardWidget;

  RocketGxDashboardWidget.prototype.$resolveConfig = function () {
    var props = this.properties(),
        fileOrd = String(props.getValue('fileConfig') || '').trim(),
        inline = String(props.getValue('config') || '').trim();

    function parse(t) {
      try { return JSON.parse(t); }
      catch (e) { return { $error: 'dashboard config is not valid JSON: ' + e.message }; }
    }
    if (fileOrd) {
      return baja.Ord.make(fileOrd).get()
        .then(function (f) { return f.readText ? f.readText() : String(f); })
        .then(parse)
        .catch(function (err) { return { $error: 'could not read ' + fileOrd + ': ' + err.message }; });
    }
    return Promise.resolve(inline ? parse(inline) : { blocks: [] });
  };

  RocketGxDashboardWidget.prototype.doInitialize = function (dom) {
    var that = this;
    that.$dom = dom;
    that.$onNav = function (ev) { that.$nav = ev.detail; that.$renderTopBar(); };
    window.addEventListener('rocketgx:navigate', that.$onNav);

    return that.$resolveConfig().then(function (cfg) {
      that.$cfg = cfg || { blocks: [] };
      that.$render();
      return that.$subscribe();
    });
  };

  RocketGxDashboardWidget.prototype.doLoad = function () {
    /* doInitialize already renders and then subscribes. Rendering again here
       rebuilds the markup from the design-time config and so discards every
       value the subscriptions have applied, leaving the view frozen at its
       drawn values. Only render if initialization has not already done it. */
    if (this.$dom && !this.$rendered) { this.$render(); }
    return Promise.resolve();
  };

  /**
   * Subscribe every ORD the config declares. On a live station each resolved
   * point pushes its value into the element that carries its id; offline every
   * ORD rejects and the design-time value stays put.
   */
  RocketGxDashboardWidget.prototype.$subscribe = function () {
    var that = this, targets = [];

    (that.$cfg.blocks || []).forEach(function (b) {
      if (b.ord) { targets.push({ id: b.id, ord: b.ord, units: b.units }); }
      /* Walk every array the block carries. The previous form chained these
         with ||, which takes only the first non-empty one — so a split block
         bound its left column and never its right, and callout items were
         never bound at all. */
      Object.keys(b).forEach(function (key) {
        if (!Array.isArray(b[key])) { return; }
        b[key].forEach(function (r) {
          if (r && r.ord && r.id) { targets.push({ id: r.id, ord: r.ord, units: r.units }); }
        });
      });
    });

    return Promise.all(targets.map(function (t) {
      return baja.Ord.make(t.ord).get({ subscriber: that.getSubscriber && that.getSubscriber() })
        .then(function (comp) {
          that.$apply(t, comp);
          /* A dashboard that reads each point once and never again is frozen at
             load. Re-apply on every change the station pushes. */
          if (comp && typeof comp.on === 'function') {
            comp.on('changed', function () { that.$apply(t, comp); });
          }
        })
        .catch(function () { /* unresolved: keep the design-time value */ });
    }));
  };

  RocketGxDashboardWidget.prototype.$apply = function (t, comp) {
    var host = this.$dom && (this.$dom[0] || this.$dom),
        node = host && host.querySelector('[data-point="' + t.id + '"]');
    if (!node || !comp) { return; }
    var out = comp.getOutDisplay ? comp.getOutDisplay() : String(comp),
        units = t.units || '',
        /* Templates differ: KPI tiles and callouts render the unit as a sibling
           of the value, rows render it as a child. Overwriting innerHTML must
           put the unit back only in the second case, or the value either loses
           its unit or grows a second one. */
        unitInside = !!node.querySelector('.gx-value__unit');

    /* A live point's display already carries its facet units. */
    if (units && out.slice(-units.length) === units) {
      out = out.slice(0, -units.length).replace(/\s+$/, '');
    }
    node.innerHTML = esc(out) +
      (unitInside && units ? ' <span class="gx-value__unit">' + esc(units) + '</span>' : '');
  };

  /* ------------------------------------------------------------------ html */

  RocketGxDashboardWidget.prototype.$render = function () {
    this.$rendered = true;
    var props = this.properties(),
        cfg = this.$cfg,
        host = this.$dom[0] || this.$dom;

    if (cfg.$error) {
      host.innerHTML = '<pre style="color:#e53935;font:12px monospace;padding:12px">' +
                       esc(cfg.$error) + '</pre>';
      return;
    }

    var root = document.createElement('div');
    root.className = 'rgx-root gx-mesh';
    root.setAttribute('data-theme', props.getValue('theme') === 'dark' ? 'dark' : 'light');
    root.style.setProperty('--gx-run', props.getValue('accentColor'));

    root.innerHTML =
      '<div class="gx-main" style="height:100%">' +
        (props.getValue('showTopBar') ? '<div data-topbar></div>' : '') +
        '<div class="gx-scroll"><div class="gx-page"><div class="gx-grid">' +
          (cfg.blocks || []).map(this.$block, this).join('') +
        '</div></div></div>' +
      '</div>';

    host.innerHTML = '';
    host.appendChild(root);

    var css = String(props.getValue('cssOverride') || '');
    if (css) {
      var st = document.createElement('style');
      st.textContent = css;
      root.appendChild(st);
    }

    this.$root = root;
    this.$renderTopBar();
    this.$wire(root);
  };

  RocketGxDashboardWidget.prototype.$renderTopBar = function () {
    var slot = this.$root && this.$root.querySelector('[data-topbar]');
    if (!slot) { return; }
    var props = this.properties(),
        site = this.$cfg.site || {},
        nav = this.$nav,
        heading = String(props.getValue('heading') || '') ||
                  (nav ? (nav.floor && nav.section === 'floors'
                            ? 'Level ' + nav.floor + ' — Floor Systems'
                            : nav.sectionLabel + ' — Master Systems')
                       : (site.view || 'Master Systems'));

    slot.outerHTML =
      '<header class="gx-topbar" data-topbar>' +
        '<div class="gx-topbar__nav">' +
          ['back', 'fwd', 'refresh', 'info'].map(function (k) {
            return '<button class="gx-btn gx-btn--icon" type="button" aria-label="' + k + '">' +
                   icon(k) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="gx-topbar__center">' +
          '<span class="gx-eyebrow gx-topbar__eyebrow">' +
            esc(String(props.getValue('site') || '') || site.name || '') + '</span>' +
          '<h1 class="gx-topbar__title">' + esc(heading) + '</h1>' +
        '</div>' +
        '<div class="gx-topbar__right">' +
          '<div class="gx-topbar__stamp">' +
            '<b>' + esc(site.time || '') + '</b><span class="gx-topbar__sep"></span>' +
            '<span>' + esc(site.date || '') + '</span><span class="gx-topbar__sep"></span>' +
            '<span>' + esc(site.city || '') + '</span>' +
          '</div>' +
          '<div class="gx-topbar__oat"><span data-point="oat">OAT ' +
            esc(site.oat || '—') + ' °C</span>' + icon('cloud') + '</div>' +
        '</div>' +
      '</header>';
  };

  RocketGxDashboardWidget.prototype.$block = function (b) {
    switch (b.type) {
      case 'kpis':     return this.$kpis(b);
      case 'values':   return this.$values(b);
      case 'split':    return this.$split(b);
      case 'callouts': return this.$callouts(b);
      case 'table':    return this.$table(b);
      case 'schematic':return this.$schematic(b);
      default:         return '';
    }
  };

  RocketGxDashboardWidget.prototype.$kpis = function (b) {
    var showOrds = this.properties().getValue('showOrds');
    return (b.tiles || []).map(function (k) {
      return '<section class="gx-card gx-card--hover gx-c' + (k.span || 3) + '">' +
        '<div class="gx-card__body">' +
          '<div style="display:flex;align-items:center;gap:var(--gx-s-4)">' +
            icon(k.icon, 'gx-badge is-' + esc(k.tone || '')) +
            '<span class="gx-eyebrow">' + esc(k.label) + '</span>' +
            (k.live ? '<span class="gx-live" style="margin-left:auto"></span>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:baseline;gap:5px;margin-top:var(--gx-s-3)">' +
            '<span class="gx-num" data-point="' + esc(k.id) + '" style="font-size:var(--gx-fs-2xl);' +
              'font-weight:var(--gx-fw-semi);color:var(--gx-text-strong);' +
              'letter-spacing:var(--gx-track-title)">' + esc(k.value) + '</span>' +
            '<span style="font-size:var(--gx-fs-sm);color:var(--gx-text-muted)">' +
              esc(k.units || '') + '</span>' +
          '</div>' +
          '<div style="font-size:var(--gx-fs-xs);color:var(--gx-text-faint)">' +
            '<b style="color:var(--gx-' + (k.good === false ? 'bad' : 'ok-deep') + ')">' +
            esc(k.delta || '') + '</b> ' + esc(k.caption || '') + '</div>' +
          (showOrds && k.ord ? '<div class="gx-ord" style="font-size:10px;opacity:.5;' +
            'font-family:var(--gx-font-mono);overflow:hidden;text-overflow:ellipsis;' +
            'white-space:nowrap">' + esc(k.ord) + '</div>' : '') +
        '</div></section>';
    }).join('');
  };

  RocketGxDashboardWidget.prototype.$values = function (b) {
    return '<section class="gx-card gx-c' + (b.span || 4) + '">' +
      '<div class="gx-card__head">' + icon(b.icon, 'gx-badge') +
        '<span class="gx-card__title">' + esc(b.title) + '</span>' +
        '<span class="gx-card__tools"><button class="gx-btn gx-btn--ghost gx-btn--icon" ' +
        'type="button" aria-label="Refresh">' + icon('refresh') + '</button></span></div>' +
      '<div class="gx-card__body">' +
        (b.rows || []).map(function (r) {
          if (r.divider) { return '<div style="height:var(--gx-s-5)"></div>'; }
          return '<div class="gx-row">' +
            '<span class="gx-row__label">' + esc(r.label) + '</span>' +
            '<span class="gx-value gx-value--wide' + (r.action ? ' gx-value--editable' : '') +
              (r.state ? ' is-' + esc(r.state) : '') + '" data-point="' + esc(r.id || '') + '">' +
              esc(r.value) + (r.units ? ' <span class="gx-value__unit">' + esc(r.units) + '</span>' : '') +
            '</span>' +
            (r.action
              ? '<button class="gx-row__act" type="button" data-action="' + esc(r.action) +
                '" data-ord="' + esc(r.ord || '') + '" aria-label="' + esc(r.action) + '">' +
                icon(r.action) + '</button>'
              : '<span style="width:26px"></span>') +
          '</div>';
        }).join('') +
      '</div></section>';
  };

  RocketGxDashboardWidget.prototype.$split = function (b) {
    function col(rows) {
      return '<div class="gx-status-list">' + (rows || []).map(function (r) {
        /* A bound row needs a data-point on the chip, or $apply has nothing to
           write to and the row stays at its design-time text forever. */
        return '<div class="gx-status-row">' +
          '<span class="gx-status-row__label">' + esc(r.label) + '</span>' +
          chip(r.chip, r.state, false, r.ord ? r.id : '') + '</div>';
      }).join('') + '</div>';
    }
    return '<section class="gx-card gx-c' + (b.span || 5) + '">' +
      '<div class="gx-card__head">' + icon(b.icon, 'gx-badge') +
        '<span class="gx-card__title">' + esc(b.title) + '</span>' +
        '<span class="gx-card__tools gx-eyebrow">' +
          ((b.left || []).length + (b.right || []).length) + ' points</span></div>' +
      '<div class="gx-card__body"><div style="display:grid;grid-template-columns:1fr 1fr;' +
        'gap:0 var(--gx-s-8)">' + col(b.left) + col(b.right) + '</div></div></section>';
  };

  RocketGxDashboardWidget.prototype.$callouts = function (b) {
    return '<section class="gx-c' + (b.span || 3) + '" style="display:flex;flex-direction:column;' +
      'gap:var(--gx-s-5)">' +
      '<div class="gx-section__head"><span class="gx-eyebrow">' + esc(b.title) +
        '</span><span class="gx-section__rule"></span></div>' +
      (b.items || []).map(function (c) {
        var foot = '';
        if (c.chip) {
          foot = '<div class="gx-callout__foot"><span class="gx-eyebrow">Status</span>' +
                 chip(c.chip, c.state || 'healthy') + '</div>';
        } else if (c.value !== undefined) {
          foot = '<div class="gx-callout__foot"><span class="gx-callout__reading gx-num" ' +
                 'data-point="' + esc(c.id || '') + '">' + esc(c.value) + '</span>' +
                 '<span class="gx-value__unit">' + esc(c.units || '') + '</span></div>';
        } else if (c.pairs) {
          foot = '<div class="gx-callout__foot" style="flex-direction:column;align-items:stretch;' +
                 'gap:2px">' + c.pairs.map(function (p) {
                   return '<div class="gx-callout__pair"><span>' + esc(p[0]) + '</span><span>' +
                          esc(p[1]) + '</span></div>';
                 }).join('') + '</div>';
        }
        return '<div class="gx-callout is-' + esc(c.bar || 'ok') + '">' +
          '<div class="gx-callout__bar"></div><div class="gx-callout__body">' +
            '<div class="gx-callout__head">' + icon(c.icon, 'gx-callout__icon') + '<span>' +
              '<span class="gx-callout__title">' + esc(c.title) + '</span>' +
              (c.note ? '<div class="gx-callout__place">' + esc(c.note) + '</div>' : '') +
              (c.place ? '<div class="gx-callout__place">' + esc(c.place) + '</div>' : '') +
            '</span></div>' + foot +
          '</div></div>';
      }).join('') + '</section>';
  };

  RocketGxDashboardWidget.prototype.$table = function (b) {
    return '<section class="gx-card gx-c' + (b.span || 7) + '">' +
      '<div class="gx-card__head">' + icon(b.icon, 'gx-badge') +
        '<span class="gx-card__title">' + esc(b.title) + '</span>' +
        '<span class="gx-card__tools"><span class="gx-seg">' +
          '<button class="gx-seg__opt is-on" type="button">All</button>' +
          '<button class="gx-seg__opt" type="button">Faults</button></span></span></div>' +
      '<div class="gx-card__body gx-card__body--flush"><table class="gx-table">' +
        '<thead><tr>' + (b.head || []).map(function (h, i) {
          return '<th' + (i === 2 ? ' style="text-align:right"' : '') + '>' + esc(h) + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        (b.rows || []).map(function (r) {
          return '<tr' + (r[1] === 'fault' ? ' class="is-fault"' : '') + '>' +
            '<td>' + esc(r[0]) + '</td>' +
            '<td><span class="gx-state is-' + esc(r[1]) + '">' + esc(r[1]).toUpperCase() + '</span></td>' +
            '<td class="num">' + esc(r[2]) + '</td>' +
            '<td class="unit">' + esc(r[3]) + '</td>' +
            '<td class="when">' + esc(r[4]) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
  };

  /* A plant schematic: equipment symbols, the pipes between them, and a
     reading on each one bound to its own point. Uncarded — the linework is
     the drawing, and a card around it adds a second frame that competes.

     Geometry comes from the config the same way a PX author places a symbol
     on a sheet: every node carries its own centre, so the composition is the
     engineer's rather than this file's. The only thing computed here is the
     pipe routing between two symbols, which is tedious to hand-place and has
     one right answer. */
  RocketGxDashboardWidget.prototype.$schematic = function (b) {
    var w = b.width || 480, h = b.height || 290,
        nodes = b.nodes || [], byId = {};

    nodes.forEach(function (n) {
      n.w = n.w || (n.kind === 'pump' ? 0 : 104);
      n.h = n.h || (n.kind === 'pump' ? 0 : 62);
      n.r = n.r || (n.kind === 'pump' ? 20 : 0);
      byId[n.id || n.label] = n;
    });

    function glyph(name, x, y, s) {
      return '<g class="gx-schem__icon" transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
             '<path d="' + (ICONS[name] || ICONS.grid) + '"/></g>';
    }

    /* A reading, drawn as one <text> so the value can be replaced on a push
       without taking its unit with it — the same split the KPI tiles use. */
    function reading(r, x, y, cls, anchorAt) {
      if (!r || r.value === undefined) { return ''; }
      return '<text class="' + cls + '" x="' + x + '" y="' + y + '"' +
             (anchorAt ? ' text-anchor="' + anchorAt + '"' : '') + '>' +
               '<tspan' + (r.id ? ' data-point="' + esc(r.id) + '"' : '') + '>' +
                 esc(r.value) + '</tspan>' +
               (r.units ? '<tspan class="gx-schem__unit" dx="3">' + esc(r.units) + '</tspan>' : '') +
             '</text>';
    }

    function symbol(n) {
      if (n.kind === 'pump') {
        return '<circle class="gx-schem__box" cx="' + n.cx + '" cy="' + n.cy + '" r="' + n.r + '"/>' +
               glyph(n.icon || 'pump', n.cx - 8.4, n.cy - 8.4, 0.7) +
               '<text class="gx-schem__label" x="' + n.cx + '" y="' + (n.cy + n.r + 13) +
                 '" text-anchor="middle">' + esc(n.label) + '</text>' +
               reading(n, n.cx, n.cy - n.r - 9, 'gx-schem__value gx-schem__value--sm', 'middle');
      }
      /* The name sits above the casing rather than inside it. Plant names are
         as long as the site's naming convention makes them, and a name that
         has to fit inside a symbol is a name that gets clipped. */
      var x0 = n.cx - n.w / 2, y0 = n.cy - n.h / 2;
      return '<text class="gx-schem__label" x="' + x0 + '" y="' + (y0 - 7) + '">' +
               esc(n.label) + '</text>' +
             '<rect class="gx-schem__box" x="' + x0 + '" y="' + y0 + '" width="' + n.w +
               '" height="' + n.h + '" rx="8"/>' +
             glyph(n.icon || 'grid', x0 + 13, n.cy - 9, 0.75) +
             reading(n, x0 + 42, n.cy + 6, 'gx-schem__value');
    }

    /* Where a pipe meets a symbol: the face it approaches from, so the line
       stops at the casing instead of running under it. */
    function anchor(n, tx, ty) {
      if (n.kind === 'pump') {
        var dx = tx - n.cx, dy = ty - n.cy, m = Math.sqrt(dx * dx + dy * dy) || 1;
        return [n.cx + dx / m * n.r, n.cy + dy / m * n.r];
      }
      if (Math.abs(tx - n.cx) * n.h >= Math.abs(ty - n.cy) * n.w) {
        return [n.cx + (tx >= n.cx ? n.w / 2 : -n.w / 2), n.cy];
      }
      return [n.cx, n.cy + (ty >= n.cy ? n.h / 2 : -n.h / 2)];
    }

    function route(p) {
      var from = byId[p.from], to = byId[p.to];
      if (!from || !to) { return null; }
      var via = p.via || [],
          first = via.length ? via[0] : [to.cx, to.cy],
          last = via.length ? via[via.length - 1] : [from.cx, from.cy],
          pts = [anchor(from, first[0], first[1])];

      via.forEach(function (v) { pts.push([v[0], v[1]]); });
      pts.push(anchor(to, last[0], last[1]));

      // Square the corners: a pipe run turns, it does not cut across.
      var squared = [pts[0]], i, a, c;
      for (i = 1; i < pts.length; i++) {
        a = squared[squared.length - 1];
        c = pts[i];
        if (a[0] !== c[0] && a[1] !== c[1]) { squared.push([c[0], a[1]]); }
        squared.push(c);
      }
      return squared;
    }

    function midpoint(pts) {
      var total = 0, seg = [], i, d;
      for (i = 1; i < pts.length; i++) {
        d = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
        seg.push(d);
        total += d;
      }
      var half = total / 2, run = 0;
      for (i = 0; i < seg.length; i++) {
        if (run + seg[i] >= half) {
          var t = seg[i] ? (half - run) / seg[i] : 0;
          return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                  pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
        }
        run += seg[i];
      }
      return pts[0];
    }

    var pipes = (b.pipes || []).map(function (p) {
      var pts = route(p);
      if (!pts) { return ''; }
      var d = 'M' + pts.map(function (q) { return q[0] + ' ' + q[1]; }).join('L'),
          cls = 'gx-schem__pipe is-' + esc(p.tone || 'chw') + (p.dim ? ' is-return' : ''),
          mid = midpoint(pts),
          label = p.label
            ? reading(p.label, mid[0], mid[1] - 7, 'gx-schem__tag', 'middle')
            : '';
      return '<path class="' + cls + '" d="' + d + '"/>' +
             '<path class="gx-schem__flow" d="' + d + '"/>' + label;
    }).join('');

    return '<section class="gx-c' + (b.span || 5) + ' gx-schem">' +
      '<div class="gx-section__head"><span class="gx-eyebrow">' + esc(b.title) +
        '</span><span class="gx-section__rule"></span></div>' +
      '<div class="gx-schem__frame">' +
        '<svg viewBox="0 0 ' + w + ' ' + h + '" fill="none" stroke-linecap="round" ' +
             'stroke-linejoin="round" role="img" aria-label="' + esc(b.caption || b.title) + '">' +
          pipes + nodes.map(symbol).join('') +
        '</svg>' +
      '</div>' +
      '<div class="gx-schem__caption gx-eyebrow">' + esc(b.caption || '') + '</div>' +
    '</section>';
  };

  /* ---------------------------------------------------------- interaction */

  RocketGxDashboardWidget.prototype.$wire = function (root) {
    var that = this;
    root.addEventListener('click', function (e) {
      var seg = e.target.closest('.gx-seg__opt'),
          act = e.target.closest('[data-action]');

      if (seg) {
        var sibs = seg.parentNode.querySelectorAll('.gx-seg__opt');
        Array.prototype.forEach.call(sibs, function (n) { n.classList.remove('is-on'); });
        seg.classList.add('is-on');
        return;
      }
      if (act) {
        var ord = act.getAttribute('data-ord');
        if (act.getAttribute('data-action') === 'open' && ord) {
          window.location.href = '/ord/' + encodeURIComponent(ord).replace(/%3A/g, ':');
        }
        /* 'edit' would raise the station's own field editor; left to the
           integrator, since the write level and facets are project decisions. */
      }
    });
  };

  RocketGxDashboardWidget.prototype.doDestroy = function () {
    if (this.$onNav) { window.removeEventListener('rocketgx:navigate', this.$onNav); }
    if (this.$dom) { (this.$dom[0] || this.$dom).innerHTML = ''; }
    return Promise.resolve();
  };

  return RocketGxDashboardWidget;
});
