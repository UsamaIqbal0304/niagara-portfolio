/**
 * station-sim.js — a simulated Niagara station, in the browser.
 *
 * The problem this solves: a bajaux widget is only interesting when its points
 * are moving. Offline there is no station, so every ORD rejects and the widget
 * shows its design-time values forever — correct behaviour, dull demo.
 *
 * This file stands in for the station. It resolves any `station:|slot:/...`
 * ORD to a live point, integrates that point on a tick using a physical model
 * inferred from its units and its name, and pushes changes to subscribers
 * through the same contract BajaScript uses. Writable points accept writes and
 * the model responds to them.
 *
 * Nothing here is widget-specific. A point is modelled from its ORD and its
 * design-time seed value, so any widget — including ones not written yet —
 * gets a live demo without this file being touched.
 *
 * It is a simulator, and the site says so. No real building is connected.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------ utilities */

  // Deterministic PRNG, so a reload gives the same plant rather than a new one.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Smooth pseudo-noise in [-1,1]: three incommensurate sines. Cheap, and it
  // wanders the way a controlled process wanders rather than jittering.
  function drift(t, seed) {
    return (Math.sin(t * 0.00037 + seed) * 0.6 +
            Math.sin(t * 0.00119 + seed * 2.7) * 0.3 +
            Math.sin(t * 0.00310 + seed * 5.1) * 0.1);
  }

  // Occupancy profile across the day, 0..1, peaking mid-afternoon.
  function occupancy(date) {
    var h = date.getHours() + date.getMinutes() / 60;
    if (h < 6 || h > 21) { return 0.06; }
    return Math.max(0.06, Math.sin((h - 6) / 15 * Math.PI)) * 0.94 + 0.06;
  }

  function decimals(seed) {
    var m = /\.(\d+)$/.exec(String(seed));
    return m ? m[1].length : 0;
  }

  /* A config may declare an ORD with no design-time value — the engineer bound
     the tile and left the value to the station. Starting those at zero makes a
     demo look broken, so each model supplies a plausible resting value. */
  var DEFAULTS = {
    temperature: [21.0, 1], load: [4.8, 1], percent: [62, 0], co2: [620, 0],
    accumulator: [1284.0, 1], pressure: [220, 0], count: [3, 0], analog: [1, 0],
    setpoint: [21.0, 1]
  };

  /* --------------------------------------------------------------- models
     A model is chosen from the units and the ORD leaf, in that order of
     confidence. Each returns the value at time t given the point's state. */

  var ENUMS = {
    occupancy: ['Occupied', 'Unoccupied'],
    mode:      ['Cooling', 'Heating', 'Fan Only'],
    stat:      ['Normal', 'Alarm'],
    run:       ['Running', 'Stopped'],
    onoff:     ['On', 'Off']
  };

  function chooseModel(ord, units, seed) {
    var leaf = (ord.split('/').pop() || ord).toLowerCase(),
        u = (units || '').toLowerCase();

    if (/sp$|setpoint|setpt/.test(leaf))              { return 'setpoint'; }
    if (/occupancy|occupied/.test(leaf))              { return 'enum:occupancy'; }
    if (/mode/.test(leaf))                            { return 'enum:mode'; }
    if (/stat$|status|frost/.test(leaf))              { return 'enum:stat'; }
    if (/alarmservice|fault|alarm/.test(leaf))        { return 'count'; }
    if (/cmd|enable|run/.test(leaf))                  { return 'enum:run'; }
    if (u.indexOf('m³') >= 0 || /watermeter|volume/.test(leaf)) { return 'accumulator'; }
    if (/hr$/.test(u) || /kwh/.test(leaf))            { return 'accumulator'; }
    if (u.indexOf('kw') >= 0 || /power|demand|load/.test(leaf))      { return 'load'; }
    if (u.indexOf('°c') >= 0 || u.indexOf('°f') >= 0 || /temp/.test(leaf)) { return 'temperature'; }
    if (u.indexOf('ppm') >= 0 || /co2/.test(leaf))    { return 'co2'; }
    if (u.indexOf('%') >= 0 || /valve|damper|speed|position/.test(leaf)) { return 'percent'; }
    if (u.indexOf('pa') >= 0 || /pressure/.test(leaf)) { return 'pressure'; }
    if (!isNaN(parseFloat(seed)))                     { return 'analog'; }
    return 'static';
  }

  /* ----------------------------------------------------------------- point */

  function Point(sim, ord, opts) {
    opts = opts || {};
    this.sim = sim;
    this.ord = ord;
    this.units = opts.units || '';
    this.seed = opts.value !== undefined && opts.value !== null ? opts.value : '0';
    this.dp = decimals(this.seed);
    this.seedNum = parseFloat(this.seed);
    if (isNaN(this.seedNum)) { this.seedNum = 0; }
    this.noise = hash(ord) % 1000 / 100;
    this.rnd = mulberry32(hash(ord));
    this.model = opts.model || chooseModel(ord, this.units, this.seed);
    /* A zero seed on a physical quantity is a drawing placeholder, not a
       reading: no space is at 0.00 °C. Treat it as absent. */
    var placeholder = (opts.value === undefined || opts.value === null || opts.value === '') ||
                      (this.seedNum === 0 && /temperature|percent|co2|load|pressure|accumulator/
                                             .test(this.model));
    if (placeholder && DEFAULTS[this.model]) {
      this.seedNum = DEFAULTS[this.model][0];
      this.dp = DEFAULTS[this.model][1];
      this.seed = this.seedNum.toFixed(this.dp);
    }
    this.writable = this.model === 'setpoint';
    this.overridden = false;
    this.value = this.seedNum;
    this.text = String(this.seed);
    this.accum = this.seedNum;
    this.listeners = [];
    this.enumIndex = 0;
    this.enumSet = null;
    if (this.model.indexOf('enum:') === 0) {
      this.enumSet = ENUMS[this.model.slice(5)] || ENUMS.onoff;
      // Seed from the design-time text where it matches one of the states.
      var i = this.enumSet.map(function (s) { return s.toLowerCase(); })
                          .indexOf(String(this.seed).toLowerCase());
      this.enumIndex = i >= 0 ? i : 0;
    }
    this.update(0, sim.clock || new Date());
  }

  Point.prototype.update = function (t, now) {
    var occ = occupancy(now), d = drift(t, this.noise), prev = this.text, v;

    switch (this.model) {
      case 'temperature':
        // Controlled space or flow temperature: sits near its seed, breathes.
        v = this.seedNum + d * (this.seedNum > 40 ? 1.8 : 0.55);
        break;
      case 'load':
        // Electrical demand tracks occupancy, with plant cycling on top.
        v = this.seedNum * (0.42 + occ * 0.62) * (1 + d * 0.07);
        break;
      case 'accumulator':
        // Monotonic: a meter never goes backwards. Rate scales with occupancy.
        /* Rate is proportional to the meter's magnitude, with a floor: a
           water meter reading 0.14 m³ would otherwise advance by 3e-6 per tick
           and appear frozen at two decimal places. */
        this.accum += Math.max(Math.pow(10, -this.dp) * 0.6,
                               this.seedNum * 0.00002) * (0.3 + occ);
        v = this.accum;
        break;
      case 'co2':
        // A reasonably ventilated space: fresh at night, ~800 ppm at full
        // occupancy, which stays under the 900 ppm threshold tiles commonly show.
        v = 400 + occ * 400 + d * 40;
        break;
      case 'percent':
        v = Math.min(100, Math.max(0, this.seedNum + d * 18 + occ * 8));
        break;
      case 'pressure':
        v = this.seedNum * (1 + d * 0.12);
        break;
      case 'count':
        // Faults are rare and sticky: step occasionally, never churn.
        if (this.rnd() < 0.004) {
          this.value = Math.max(0, Math.round(this.value) + (this.rnd() < 0.55 ? 1 : -1));
        }
        v = this.value;
        break;
      case 'setpoint':
        v = this.value;          // holds until written
        break;
      case 'static':
        this.text = String(this.seed);
        return false;
      default:
        v = this.seedNum + d * Math.abs(this.seedNum || 1) * 0.04;
    }

    if (this.enumSet) {
      if (this.model === 'enum:occupancy') {
        this.enumIndex = occ > 0.25 ? 0 : 1;
      } else if (this.model === 'enum:stat') {
        this.enumIndex = this.rnd() < 0.0015 ? 1 - this.enumIndex : this.enumIndex;
      } else if (this.rnd() < 0.002) {
        this.enumIndex = Math.floor(this.rnd() * this.enumSet.length);
      }
      this.text = this.enumSet[this.enumIndex];
    } else {
      this.value = v;
      this.text = this.model === 'count' ? String(Math.round(v)) : v.toFixed(this.dp);
    }

    return this.text !== prev;
  };

  Point.prototype.write = function (v) {
    var n = parseFloat(v);
    if (!isNaN(n)) {
      this.value = n;
      this.text = n.toFixed(this.dp);
      this.overridden = true;
      this.sim.influence(this, n);
      this.emit();
    }
    return this;
  };

  Point.prototype.emit = function () {
    for (var i = 0; i < this.listeners.length; i++) {
      try { this.listeners[i].call(this, this); } catch (err) { /* a bad handler is not fatal */ }
    }
  };

  /* ------------------------------------------------------------ component
     The object a widget receives from an ORD resolution. It exposes the small
     slice of the BajaScript component API that dashboard widgets actually use. */

  function Component(point) { this.$point = point; }

  Component.prototype.getOutDisplay = function () {
    return this.$point.text + (this.$point.units ? ' ' + this.$point.units : '');
  };
  Component.prototype.getDisplayName = function () { return this.$point.ord.split('/').pop(); };
  Component.prototype.getValue = function () { return this.$point.value; };
  Component.prototype.getOrd   = function () { return this.$point.ord; };
  Component.prototype.isWritable = function () { return this.$point.writable; };
  Component.prototype.getStatus = function () { return { isValid: function () { return true; } }; };

  Component.prototype.on = function (event, cb) {
    if (event === 'changed' || event === 'change') { this.$point.listeners.push(cb); }
    return this;
  };
  Component.prototype.attach = Component.prototype.on;

  // Writes. Both spellings, because widgets in the wild use either.
  Component.prototype.set = function (arg) {
    var v = arg && typeof arg === 'object' ? (arg.value !== undefined ? arg.value : arg.out) : arg;
    this.$point.write(v);
    return Promise.resolve(this);
  };
  Component.prototype.setValue = Component.prototype.set;
  Component.prototype.invoke = function (action, arg) { return this.set(arg); };

  /* ---------------------------------------------------------------- station */

  function StationSim(options) {
    options = options || {};
    this.points = {};
    this.files = options.files || {};
    this.interval = options.interval || 1000;
    this.t = 0;
    this.started = false;
    /* The simulated station sits in the middle of a working afternoon and
       advances in real time from there. Without this, a visitor at 03:00 sees
       an unoccupied building with everything switched off and concludes the
       demo is broken. */
    this.clock = options.clock || (function () {
      var d = new Date(); d.setHours(14, 20, 0, 0); return d;
    }());
    this.seeds = {};            // ord -> design-time value harvested from config
    this.subscribers = [];
  }

  /* Harvest design-time values and units out of a widget's own config, so each
     simulated point starts where the engineer drew it rather than at zero. */
  StationSim.prototype.seedFromConfig = function (cfg) {
    var self = this;
    (function walk(node) {
      if (!node || typeof node !== 'object') { return; }
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node.ord === 'string' && node.ord.indexOf('station:') === 0) {
        self.seeds[node.ord] = { value: node.value, units: node.units };
      }
      Object.keys(node).forEach(function (k) { walk(node[k]); });
    }(cfg));
    return this;
  };

  StationSim.prototype.point = function (ord) {
    if (!this.points[ord]) {
      var s = this.seeds[ord] || {};
      this.points[ord] = new Point(this, ord, { value: s.value, units: s.units });
    }
    return this.points[ord];
  };

  /* A write to a set point should visibly move the plant that serves it, or the
     control is a toy. Anything sharing the set point's equipment node and
     measuring the same quantity is nudged toward the new target. */
  StationSim.prototype.influence = function (sp, target) {
    var branch = sp.ord.split('/points/')[0], self = this;
    Object.keys(this.points).forEach(function (ord) {
      if (ord === sp.ord || ord.indexOf(branch) !== 0) { return; }
      var p = self.points[ord];
      if (p.model === 'temperature') { p.seedNum = target + (p.seedNum > 40 ? 0 : 0.4); }
      if (p.model === 'percent' || p.model === 'load') {
        p.seedNum = Math.max(p.seedNum * 0.4, p.seedNum * (1 + (target - sp.seedNum) * 0.05));
      }
    });
  };

  StationSim.prototype.start = function () {
    if (this.started) { return this; }
    this.started = true;
    var self = this;
    this.timer = setInterval(function () {
      // Pause when the tab is hidden: a background iframe burning CPU on a
      // marketing page is rude, and nobody is looking at it.
      if (global.document && global.document.hidden) { return; }
      self.t += self.interval;
      var now = new Date(self.clock.getTime() + self.t);
      Object.keys(self.points).forEach(function (ord) {
        var p = self.points[ord];
        if (p.update(self.t, now) ) { p.emit(); }
      });
      self.subscribers.forEach(function (fn) { try { fn(self); } catch (e) {} });
    }, this.interval);
    return this;
  };

  StationSim.prototype.stop = function () {
    clearInterval(this.timer); this.started = false; return this;
  };

  StationSim.prototype.onTick = function (fn) { this.subscribers.push(fn); return this; };

  /* History. A BQL rollup ORD returns a series; widgets charting history get
     a plausible daily curve rather than an empty axis. */
  StationSim.prototype.history = function (ord, count) {
    var n = count || 24, out = [], i, rnd = mulberry32(hash(ord)), now = this.clock || new Date();
    for (i = n - 1; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 3600000);
      out.push({
        timestamp: d,
        value: Math.round((0.35 + occupancy(d) * 0.65) * 1000 + (rnd() - 0.5) * 90)
      });
    }
    return out;
  };

  /* --------------------------------------------------------- the baja shim */

  StationSim.prototype.baja = function () {
    var sim = this;
    return {
      $isSimulator: true,
      Ord: {
        make: function (ordStr) {
          var ord = String(ordStr);
          return {
            toString: function () { return ord; },
            get: function () {
              // file: ORDs — the widget's own config, inlined at build time.
              if (sim.files.hasOwnProperty(ord)) {
                var text = sim.files[ord];
                return Promise.resolve({
                  readText: function () { return Promise.resolve(text); },
                  getText:  function () { return text; }
                });
              }
              if (ord.indexOf('history:') === 0 || ord.indexOf('bql:') >= 0) {
                var series = sim.history(ord);
                return Promise.resolve({
                  $series: series,
                  cursor: function () { return series; },
                  toArray: function () { return series; },
                  each: function (fn) { series.forEach(fn); return this; },
                  on: function () { return this; }
                });
              }
              if (ord.indexOf('station:') === 0 || ord.indexOf('slot:') === 0 ||
                  ord.indexOf('local:') === 0) {
                return Promise.resolve(new Component(sim.point(ord)));
              }
              return Promise.reject(new Error('simulator: no handler for ' + ord));
            }
          };
        }
      },
      Subscriber: function () {
        return { attach: function () {}, detach: function () {}, subscribe: function () {} };
      },
      outln: function () {}
    };
  };

  global.StationSim = StationSim;
}(window));
