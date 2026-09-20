/**
 * demo-runtime.js — boots an unmodified bajaux widget outside Niagara.
 *
 * Niagara's HTML5 (ux) profile renders a PX view by creating a DOM element per
 * `wb:WebWidget` and handing it to the AMD module named by that widget's `js`
 * ORD. This file does the same four things:
 *
 *   1. provide just enough AMD for the widget's own `define(...)` call,
 *   2. stub `bajaux/Widget` and `bajaux/mixin/subscriberMixIn`,
 *   3. point `baja!` at the station simulator rather than at nothing,
 *   4. call the widget's documented lifecycle and hand it a host element.
 *
 * The widget source is never modified. What renders in the browser is the same
 * file that would be loaded by a licensed station, which is the entire point —
 * if the widget needed changing to run here, running here would prove nothing.
 *
 * Load order matters: this file first (it installs `define`), then the widget
 * source, then a call to `bootDemo()`.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ AMD */

  var registry = {}, cache = {};

  function define(id, deps, factory) {
    // define(deps, factory) — anonymous, the form the widgets actually use.
    if (typeof id !== 'string') { factory = deps; deps = id; id = global.__pendingModuleId; }
    if (typeof deps === 'function') { factory = deps; deps = []; }
    registry[id] = { deps: deps || [], factory: factory };
  }
  define.amd = {};

  function resolve(id) {
    if (cache.hasOwnProperty(id)) { return cache[id]; }
    if (global.__stubs && global.__stubs.hasOwnProperty(id)) { return global.__stubs[id]; }
    if (id.indexOf('css!') === 0) { return {}; }   // stylesheets are <link>ed by the page
    var def = registry[id];
    if (!def) { throw new Error('demo: module not found: ' + id); }
    cache[id] = null;
    var exports = def.factory.apply(null, def.deps.map(resolve));
    cache[id] = exports;
    return exports;
  }

  global.define = define;
  global.require = function (deps, cb) {
    var mods = (typeof deps === 'string' ? [deps] : deps).map(resolve);
    return cb ? cb.apply(null, mods) : mods[0];
  };

  /* --------------------------------------------------------- bajaux stubs */

  function Properties(values) { this.$v = values || {}; }
  Properties.prototype.getValue = function (name) { return this.$v[name]; };
  Properties.prototype.setValue = function (name, v) { this.$v[name] = v; return this; };
  Properties.prototype.add = function (spec) {
    if (spec && spec.name !== undefined && !(spec.name in this.$v)) { this.$v[spec.name] = spec.value; }
    return this;
  };
  Properties.prototype.has = function (name) { return name in this.$v; };

  /* The widgets call Widget.call(this, { params: ..., defaults: widgetDefaults() }),
     where defaults.properties is the property sheet a PX author would edit. */
  function Widget(opts) {
    opts = opts || {};
    var values = {};
    if (opts.defaults && opts.defaults.properties) {
      Object.keys(opts.defaults.properties).forEach(function (k) {
        values[k] = opts.defaults.properties[k];
      });
    }
    if (opts.params) {
      Object.keys(opts.params).forEach(function (k) { values[k] = opts.params[k]; });
    }
    this.$properties = new Properties(values);
  }
  Widget.prototype.properties = function () { return this.$properties; };
  Widget.prototype.getDom = function () { return this.$dom; };
  Widget.prototype.jq = function () { return this.$dom; };
  Widget.prototype.initialize = function (dom) {
    var that = this;
    that.$dom = dom;
    return Promise.resolve(that.doInitialize ? that.doInitialize(dom) : undefined)
                  .then(function () { return that.doLoad ? that.doLoad() : undefined; });
  };
  Widget.prototype.destroy = function () {
    return Promise.resolve(this.doDestroy ? this.doDestroy() : undefined);
  };

  /* The subscriber. In Niagara this is what a component is attached to so the
     station knows to push changes for it; the simulator honours the same
     contract, so nothing widget-side has to know the difference. */
  function subscriberMixIn(w) {
    w.$subscriber = {
      $attached: [],
      attach: function (c) { this.$attached.push(c); return this; },
      detach: function () { this.$attached.length = 0; return this; },
      subscribe: function () { return Promise.resolve(); },
      unsubscribe: function () { return Promise.resolve(); }
    };
    w.getSubscriber = function () { return this.$subscriber; };
    return w;
  }

  /* ----------------------------------------------------------------- boot */

  global.bootDemo = function (cfg) {
    cfg = cfg || global.__DEMO__ || {};

    var sim = new global.StationSim({
      files: cfg.files || {},
      interval: cfg.interval || 1000
    });

    // Seed each point from the design-time values in the widget's own config,
    // so the simulated plant starts where the engineer drew it.
    Object.keys(cfg.files || {}).forEach(function (ord) {
      try { sim.seedFromConfig(JSON.parse(cfg.files[ord])); } catch (err) { /* not JSON */ }
    });

    global.__stubs = {
      'bajaux/Widget': Widget,
      'bajaux/mixin/subscriberMixIn': subscriberMixIn,
      'baja!': sim.baja(),
      'baja': sim.baja(),
      'Promise': Promise,
      'jquery': null,
      'lex!': { get: function () { return ''; } }
    };

    var WidgetCtor;
    try {
      WidgetCtor = resolve(cfg.module);
    } catch (err) {
      return fail(err);
    }

    var host = document.getElementById('demo-host');
    var widget = new WidgetCtor();

    // Properties come from the PX WebWidget element in a real view; here they
    // come from the demo definition, which is the same data by another route.
    Object.keys(cfg.properties || {}).forEach(function (k) {
      widget.properties().setValue(k, cfg.properties[k]);
    });

    sim.start();
    global.__sim = sim;
    global.__widget = widget;

    return Promise.resolve(widget.initialize(host))
      .then(function () {
        document.body.classList.add('is-live');
        // Tell the parent page the demo is up, so it can show its status chip.
        try { parent.postMessage({ demo: cfg.id, status: 'live' }, '*'); } catch (e) {}
      })
      .catch(fail);

    function fail(err) {
      host.innerHTML = '<div class="demo-error"><strong>This demo failed to start.</strong>' +
        '<pre>' + String(err && err.stack || err).replace(/[<&]/g, function (c) {
          return c === '<' ? '&lt;' : '&amp;';
        }) + '</pre>' +
        '<p>The widget itself is fine — this is the demo harness. ' +
        'The screenshots on the Work page show the same views.</p></div>';
      try { parent.postMessage({ demo: cfg.id, status: 'error' }, '*'); } catch (e) {}
    }
  };

  /* Theme toggling from the parent page, so the demo frame and the site chrome
     stay in step without the frame reloading. */
  global.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.setTheme === undefined) { return; }
    var w = global.__widget;
    if (w && w.properties) {
      w.properties().setValue('theme', ev.data.setTheme);
      var root = document.querySelector('[data-theme]');
      if (root) { root.setAttribute('data-theme', ev.data.setTheme); }
    }
  });
}(window));
