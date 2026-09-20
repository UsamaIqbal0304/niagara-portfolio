/**
 * iOS-themed dashboard stage for Niagara 4 PX graphics.
 *
 * Companion to IosSideBarWidget. Renders a top bar plus a card grid of
 * stat tiles, activity rings, iOS toggles, a set-point slider and an alarm
 * console. Every tile declares an `ord`; values arrive through the standard
 * bajaux subscriber mix-in, so the same file runs against a live station.
 *
 * @module nmodule/iosUi/rc/IosDashboardWidget
 */
define([
  'bajaux/Widget',
  'bajaux/mixin/subscriberMixIn',
  'baja!',
  'Promise',
  'css!nmodule/iosUi/rc/IosSideBarWidget'
], function (Widget, subscriberMixIn, baja, Promise) {
  'use strict';

  function widgetDefaults() {
    return {
      properties: {
        config: '',
        fileConfig: '',
        cssOverride: '',
        heading: 'Level 2 — East Wing',
        subheading: 'DemoBuilding · live',
        cornerRadius: 22,
        accentColor: '#0a84ff',
        showOrds: true,
        pollRate: 5
      }
    };
  }

  var ICONS = {
    thermo: 'M12 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0z',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8',
    drop: 'M12 3s6 6.4 6 10.4A6 6 0 0 1 6 13.4C6 9.4 12 3 12 3z',
    bell: 'M18 15V10a6 6 0 1 0-12 0v5l-1.6 2.2h15.2zM10 20a2 2 0 0 0 4 0',
    menu: 'M4 7h16M4 12h16M4 17h16'
  };

  function ic(key, tone) {
    return '<span class="iosUi-tile-ic ' + (tone || '') + '"><svg viewBox="0 0 24 24">' +
           '<path d="' + (ICONS[key] || ICONS.bolt) + '" fill="none" stroke="currentColor"/>' +
           '</svg></span>';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* --------------------------------------------------------------- widget */

  var IosDashboardWidget = function IosDashboardWidget(params) {
    Widget.call(this, { params: params, defaults: widgetDefaults() });
    subscriberMixIn(this);
    this.$cfg = { tiles: [] };
  };

  IosDashboardWidget.prototype = Object.create(Widget.prototype);
  IosDashboardWidget.prototype.constructor = IosDashboardWidget;

  IosDashboardWidget.prototype.$resolveConfig = function () {
    var props = this.properties(),
        fileOrd = String(props.getValue('fileConfig') || '').trim(),
        inline = String(props.getValue('config') || '').trim();

    function parse(t) {
      try { return JSON.parse(t); } catch (e) { return { $error: e.message }; }
    }
    if (fileOrd) {
      return baja.Ord.make(fileOrd).get()
        .then(function (f) { return f.readText ? f.readText() : String(f); })
        .then(parse);
    }
    return Promise.resolve(inline ? parse(inline) : { tiles: [] });
  };

  IosDashboardWidget.prototype.doInitialize = function (dom) {
    var that = this;
    that.$dom = dom;
    return that.$resolveConfig().then(function (cfg) {
      that.$cfg = cfg || { tiles: [] };
      that.$render();
      return that.$subscribeTiles();
    });
  };

  /**
   * Subscribe every tile ORD through the bajaux subscriber mix-in. On a live
   * station each resolved component pushes changes back into the tile; in the
   * offline preview harness the stub resolver returns the seeded value.
   */
  IosDashboardWidget.prototype.$subscribeTiles = function () {
    var that = this,
        tiles = (that.$cfg.tiles || []).filter(function (t) { return t.ord; });

    return Promise.all(tiles.map(function (t) {
      return baja.Ord.make(t.ord).get({ subscriber: that.getSubscriber && that.getSubscriber() })
        .then(function (comp) {
          that.$applyValue(t, comp);
          /* Re-apply on every change the station pushes, or the tile shows the
             value it had at subscribe time for the life of the view. */
          if (comp && typeof comp.on === 'function') {
            comp.on('changed', function () { that.$applyValue(t, comp); });
          }
        })
        .catch(function () { /* unresolved ORD stays at its design-time value */ });
    }));
  };

  IosDashboardWidget.prototype.$applyValue = function (tile, comp) {
    var node = this.$dom && (this.$dom[0] || this.$dom).querySelector('[data-tile="' + tile.id + '"] .iosUi-value');
    if (!node || !comp) { return; }
    var out = comp.getOutDisplay ? comp.getOutDisplay() : comp.toString(),
        units = tile.units || '';
    /* A live point's display already carries its facet units, so appending the
       tile's units unconditionally renders "18.4 °C °C". Only add ours when the
       station has not supplied them. */
    if (units && out.slice(-units.length) === units) {
      out = out.slice(0, -units.length).replace(/\s+$/, '');
    }
    node.innerHTML = esc(out) + (units ? '<small>' + esc(units) + '</small>' : '');
  };

  /* ----------------------------------------------------------------- html */

  IosDashboardWidget.prototype.$render = function () {
    var props = this.properties(),
        cfg = this.$cfg,
        el = this.$dom[0] || this.$dom,
        root = document.createElement('div');

    root.className = 'iosUi-root';
    root.style.setProperty('--ios-radius-xl', props.getValue('cornerRadius') + 'px');
    root.style.setProperty('--ios-blue', props.getValue('accentColor'));
    root.style.background = 'transparent';

    root.innerHTML =
      '<div class="iosUi-stage">' + this.$topbarHtml(cfg) + this.$bodyHtml(cfg) + '</div>';

    el.innerHTML = '';
    el.appendChild(root);
    this.$wire(root);
  };

  IosDashboardWidget.prototype.$topbarHtml = function (cfg) {
    var props = this.properties(),
        segs = cfg.segments || ['Live', 'Today', 'Week'];
    return '<header class="iosUi-topbar">' +
      '<div class="iosUi-hamburger"><svg viewBox="0 0 24 24"><path d="' + ICONS.menu + '"/></svg></div>' +
      '<div class="iosUi-crumb">' + esc(cfg.heading || props.getValue('heading')) +
        '<small>' + esc(cfg.subheading || props.getValue('subheading')) + '</small></div>' +
      '<div class="iosUi-spacer"></div>' +
      '<div class="iosUi-seg">' + segs.map(function (s, i) {
        return '<div class="iosUi-seg-opt' + (i === 0 ? ' is-on' : '') + '">' + esc(s) + '</div>';
      }).join('') + '</div>' +
      '<div class="iosUi-pill"><span class="iosUi-dot"></span>' +
        esc(cfg.statusText || 'Station connected') + '</div>' +
    '</header>';
  };

  IosDashboardWidget.prototype.$bodyHtml = function (cfg) {
    var that = this,
        cards = (cfg.tiles || []).map(function (t) { return that.$tileHtml(t); }).join('');
    return '<div class="iosUi-body"><div class="iosUi-grid">' + cards + '</div></div>';
  };

  IosDashboardWidget.prototype.$tileHtml = function (t) {
    var showOrd = this.properties().getValue('showOrds'),
        span = 'iosUi-c' + (t.span || 3),
        head = '<div class="iosUi-card-head">' + ic(t.icon, t.tone) +
               '<span class="iosUi-card-title">' + esc(t.title) + '</span></div>',
        ord = showOrd && t.ord ? '<div class="iosUi-ord">' + esc(t.ord) + '</div>' : '',
        inner;

    switch (t.kind) {
      case 'ring':      inner = this.$ringHtml(t);   break;
      case 'bars':      inner = this.$barsHtml(t);   break;
      case 'switches':  inner = this.$switchHtml(t); break;
      case 'setpoint':  inner = this.$slideHtml(t);  break;
      case 'alarms':    inner = this.$alarmHtml(t);  break;
      default:          inner = this.$statHtml(t);
    }

    return '<section class="iosUi-card ' + span + '" data-tile="' + esc(t.id) + '">' +
           head + inner + ord + '</section>';
  };

  IosDashboardWidget.prototype.$statHtml = function (t) {
    var dir = (t.delta || '').indexOf('-') === 0 ? 'down' : 'up';
    return '<div class="iosUi-value">' + esc(t.value) +
             (t.units ? '<small>' + esc(t.units) + '</small>' : '') + '</div>' +
           '<div class="iosUi-sub2"><span class="iosUi-trend ' + dir + '">' +
             esc(t.delta || '') + '</span> ' + esc(t.caption || '') + '</div>';
  };

  IosDashboardWidget.prototype.$ringHtml = function (t) {
    var r = 44, c = 2 * Math.PI * r,
        pct = Math.max(0, Math.min(100, Number(t.percent) || 0)),
        off = c * (1 - pct / 100);
    return '<div class="iosUi-ring">' +
      '<svg viewBox="0 0 108 108">' +
        '<circle class="trk" cx="54" cy="54" r="' + r + '"/>' +
        '<circle class="val" cx="54" cy="54" r="' + r + '" stroke="' + esc(t.color || '#30d158') +
          '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg>' +
      '<div><div class="iosUi-value">' + pct + '<small>%</small></div>' +
      '<div class="iosUi-sub2">' + esc(t.caption || '') + '</div></div></div>';
  };

  IosDashboardWidget.prototype.$barsHtml = function (t) {
    var vals = t.series || [], max = Math.max.apply(null, vals.concat([1]));
    return '<div class="iosUi-bars">' + vals.map(function (v) {
        var h = Math.max(4, Math.round(v / max * 96));
        return '<div class="iosUi-bar' + (v >= max * 0.92 ? ' hi' : '') +
               '" style="height:' + h + 'px"></div>';
      }).join('') + '</div>' +
      '<div class="iosUi-axis">' + (t.labels || []).map(function (l) {
        return '<span>' + esc(l) + '</span>';
      }).join('') + '</div>';
  };

  IosDashboardWidget.prototype.$switchHtml = function (t) {
    return (t.rows || []).map(function (r) {
      return '<div class="iosUi-row"><div class="iosUi-row-name">' + esc(r.name) +
        '<div class="iosUi-row-sub">' + esc(r.sub || '') + '</div></div>' +
        '<div class="iosUi-switch' + (r.on ? ' is-on' : '') + '" data-ord="' +
        esc(r.ord || '') + '"></div></div>';
    }).join('');
  };

  IosDashboardWidget.prototype.$slideHtml = function (t) {
    var min = t.min !== undefined ? t.min : 16,
        max = t.max !== undefined ? t.max : 26,
        v = t.value !== undefined ? t.value : 21,
        pct = Math.round((v - min) / (max - min) * 100);
    return '<div class="iosUi-value">' + esc(v) + '<small>' + esc(t.units || '°C') + '</small></div>' +
      '<div class="iosUi-slider"><div class="iosUi-slider-fill" style="right:' + (100 - pct) + '%"></div>' +
      '<div class="iosUi-slider-lbl"><span>' + min + '°</span><span>' + max + '°</span></div></div>' +
      '<div class="iosUi-sub2">' + esc(t.caption || 'Occupied set point') + '</div>';
  };

  IosDashboardWidget.prototype.$alarmHtml = function (t) {
    return (t.alarms || []).map(function (a) {
      var tone = a.priority === 'critical' ? 'crit' : (a.priority === 'warning' ? 'warn' : 'ok');
      return '<div class="iosUi-alarm"><div class="iosUi-alarm-ic ' + tone + '">' +
        (tone === 'ok' ? '✓' : '!') + '</div>' +
        '<div class="iosUi-alarm-txt"><div class="iosUi-alarm-t">' + esc(a.text) + '</div>' +
        '<div class="iosUi-alarm-s">' + esc(a.source) + ' · ' + esc(a.time) + '</div></div>' +
        '<div class="iosUi-ack">Ack</div></div>';
    }).join('');
  };

  /* ----------------------------------------------------------------- wire */

  IosDashboardWidget.prototype.$wire = function (root) {
    var that = this;

    root.addEventListener('click', function (ev) {
      var sw = ev.target.closest('.iosUi-switch'),
          seg = ev.target.closest('.iosUi-seg-opt'),
          ack = ev.target.closest('.iosUi-ack');

      if (sw) {
        sw.classList.toggle('is-on');
        that.$writePoint(sw.getAttribute('data-ord'), sw.classList.contains('is-on'));
      } else if (seg) {
        seg.parentNode.querySelectorAll('.iosUi-seg-opt')
          .forEach(function (n) { n.classList.remove('is-on'); });
        seg.classList.add('is-on');
      } else if (ack) {
        ack.closest('.iosUi-alarm').style.opacity = 0.35;
      }
    });
  };

  /** Set-point write — the ux equivalent of a PX SetPointBinding. */
  IosDashboardWidget.prototype.$writePoint = function (ord, value) {
    if (!ord) { return Promise.resolve(); }
    return baja.Ord.make(ord).get()
      .then(function (point) { return point.set && point.set({ value: value }); })
      .catch(function () { /* preview harness: no station to write to */ });
  };

  IosDashboardWidget.prototype.doDestroy = function () {
    if (this.$dom) { (this.$dom[0] || this.$dom).innerHTML = ''; }
    return Promise.resolve();
  };

  return IosDashboardWidget;
});
