/**
 * iOS-themed side bar menu for Niagara 4 PX graphics.
 *
 * Written to the same shape Tridium's own -ux widgets use
 * (see nmodule/webChart/rc/gauge/CircularGaugeWidget): an AMD module that
 * returns a subclass of bajaux/Widget, dropped onto a PX view as a
 * wb:WebWidget whose `js` property is the ORD view:iosUi:IosSideBarWidget.
 *
 * Config is a JSON string (property `config`) or a station file ORD
 * (property `fileConfig`, e.g. file:^iosUi/menu.json). The schema is
 * deliberately key-compatible with the Works Software side bar menu so
 * existing configs drop straight in, plus iOS-specific additions
 * (cornerRadius, blur, accentColor, glass).
 *
 * @module nmodule/iosUi/rc/IosSideBarWidget
 */
define([
  'bajaux/Widget',
  'bajaux/mixin/subscriberMixIn',
  'baja!',
  'Promise',
  'css!nmodule/iosUi/rc/IosSideBarWidget'
], function (Widget, subscriberMixIn, baja, Promise) {
  'use strict';

  /**
   * PX-editable properties. Every key here shows up in the WebWidget
   * property sheet in Workbench, exactly like the Works Software widgets.
   */
  function widgetDefaults() {
    return {
      properties: {
        config: '',
        fileConfig: '',
        cssOverride: '',
        title: 'Dashboard',
        showProfile: true,
        showLogoutButton: true,
        logoutUrl: '/logout',
        startOpen: true,
        // --- iOS theming ------------------------------------------------
        cornerRadius: 28,
        accentColor: '#0a84ff',
        backgroundColor: 'rgba(18,18,20,0.82)',
        menuLinkTextColor: 'rgba(235,235,245,0.62)',
        menuFontFamily: '',
        menuFontSize: '14.5px',
        glass: true
      }
    };
  }

  var DEFAULT_CONFIG = {
    title: 'Dashboard',
    showProfile: true,
    menu: []
  };

  /* ------------------------------------------------------------------ svg */

  var ICONS = {
    'bx-home': 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
    'bx-grid-alt': 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    'bx-pie-chart-alt': 'M12 3a9 9 0 1 0 9 9h-9z M12 3v9h9A9 9 0 0 0 12 3z',
    'bx-line-chart': 'M4 4v16h16M7.5 14.5l3.5-4 3 3 4.5-6',
    'bx-bell': 'M18 15V10a6 6 0 1 0-12 0v5l-1.6 2.2h15.2zM10 20a2 2 0 0 0 4 0',
    'bx-cog': 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.4-2-3.4-2.3 1a7.6 7.6 0 0 0-2.6-1.5L14.2 2H9.8l-.3 2.7a7.6 7.6 0 0 0-2.6 1.5l-2.3-1-2 3.4 2 1.4a7.6 7.6 0 0 0 0 3l-2 1.4 2 3.4 2.3-1a7.6 7.6 0 0 0 2.6 1.5l.3 2.7h4.4l.3-2.7a7.6 7.6 0 0 0 2.6-1.5l2.3 1 2-3.4z',
    'bx-buildings': 'M4 21V7l7-4v18M11 21h9V11l-9-4M14.5 11v1.5M17.5 11v1.5M14.5 15v1.5M17.5 15v1.5M7 9v1.5M7 13v1.5',
    'bx-wind': 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8',
    'bx-bolt': 'M13 2 4 14h7l-1 8 9-12h-7z',
    'bx-map': 'M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5zM9 4v14M15 6.5v14',
    'bx-calendar': 'M4 6.5h16V21H4zM4 10.5h16M8 3v4M16 3v4',
    'bx-log-out': 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',
    'bx-menu': 'M4 7h16M4 12h16M4 17h16',
    'bx-chevron': 'M9 6l6 6-6 6'
  };

  function svg(pathKey, cls) {
    var d = ICONS[pathKey] || ICONS['bx-grid-alt'];
    return '<span class="' + (cls || 'iosUi-ic') + '"><svg viewBox="0 0 24 24">' +
           '<path d="' + d + '"/></svg></span>';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Works Software config allows `link` to be either a bare ORD string or
   * [ text, ord, target ]. Normalise both forms.
   */
  function normLink(link) {
    if (!link) { return null; }
    if (typeof link === 'string') { return { text: '', ord: link, target: '' }; }
    return { text: link[0] || '', ord: link[1] || '', target: link[2] || '' };
  }

  function itemText(item) {
    if (item.li) { return item.li; }
    var l = normLink(item.link);
    return l ? l.text : '';
  }

  /* --------------------------------------------------------------- widget */

  /**
   * @class
   * @alias module:nmodule/iosUi/rc/IosSideBarWidget
   * @extends module:bajaux/Widget
   */
  var IosSideBarWidget = function IosSideBarWidget(params) {
    Widget.call(this, { params: params, defaults: widgetDefaults() });
    subscriberMixIn(this);
    this.$cfg = DEFAULT_CONFIG;
  };

  IosSideBarWidget.prototype = Object.create(Widget.prototype);
  IosSideBarWidget.prototype.constructor = IosSideBarWidget;

  /**
   * Resolve the menu config: `fileConfig` ORD wins over the inline `config`
   * string, matching the Works Software precedence rule.
   */
  IosSideBarWidget.prototype.$resolveConfig = function () {
    var that = this,
        props = that.properties(),
        fileOrd = String(props.getValue('fileConfig') || '').trim(),
        inline = String(props.getValue('config') || '').trim();

    function parse(text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return { $error: 'Menu config is not valid JSON: ' + e.message };
      }
    }

    if (fileOrd) {
      return baja.Ord.make(fileOrd).get()
        .then(function (file) { return file.readText ? file.readText() : String(file); })
        .then(parse)
        .catch(function (err) {
          return { $error: 'Could not read ' + fileOrd + ': ' + err.message };
        });
    }
    return Promise.resolve(inline ? parse(inline) : DEFAULT_CONFIG);
  };

  IosSideBarWidget.prototype.doInitialize = function (dom) {
    var that = this;
    that.$dom = dom;
    return that.$resolveConfig().then(function (cfg) {
      that.$cfg = cfg || DEFAULT_CONFIG;
      that.$render();
    });
  };

  /** Re-render when the bound component value changes. */
  IosSideBarWidget.prototype.doLoad = function () {
    if (this.$dom) { this.$render(); }
    return Promise.resolve();
  };

  IosSideBarWidget.prototype.$render = function () {
    var that = this,
        props = that.properties(),
        cfg = that.$cfg,
        el = that.$dom[0] || that.$dom;

    if (cfg.$error) {
      el.innerHTML = '<div class="iosUi-root" style="padding:20px;color:#ff453a;' +
                     'font-family:monospace">' + esc(cfg.$error) + '</div>';
      return;
    }

    var root = document.createElement('div');
    root.className = 'iosUi-root iosUi-shell' + (props.getValue('startOpen') ? ' is-open' : '');
    root.style.setProperty('--ios-radius-xl', props.getValue('cornerRadius') + 'px');
    root.style.setProperty('--ios-blue', props.getValue('accentColor'));
    root.style.setProperty('--ios-sidebar', cfg.backgroundColor || props.getValue('backgroundColor'));
    if (cfg.menuLinkTextColor) { root.style.setProperty('--ios-label-2', cfg.menuLinkTextColor); }
    if (!props.getValue('glass')) { root.style.backdropFilter = 'none'; }

    root.innerHTML = that.$sidebarHtml(cfg);
    el.innerHTML = '';
    el.appendChild(root);

    var css = String(props.getValue('cssOverride') || '');
    if (css) {
      var s = document.createElement('style');
      s.textContent = css;
      root.appendChild(s);
    }

    that.$wire(root);
  };

  IosSideBarWidget.prototype.$sidebarHtml = function (cfg) {
    var props = this.properties(),
        title = cfg.title || props.getValue('title'),
        user = cfg.user || {},
        html = '';

    html += '<nav class="iosUi-side">';
    html += '<div class="iosUi-brand">' +
              '<div class="iosUi-brand-mark">' + esc((title || 'N')[0]) + '</div>' +
              '<div class="iosUi-brand-text">' +
                '<div class="iosUi-brand-title">' + esc(title) + '</div>' +
                '<div class="iosUi-brand-sub">' + esc(cfg.subtitle || 'Niagara 4 Station') + '</div>' +
              '</div>' +
            '</div>';

    if (cfg.showProfile !== false && props.getValue('showProfile')) {
      html += '<div class="iosUi-profile">' +
                '<div class="iosUi-avatar">' + esc((user.fullName || 'U')[0]) + '</div>' +
                '<div class="iosUi-profile-text">' +
                  '<div class="iosUi-profile-name">' + esc(user.fullName || 'Station User') + '</div>' +
                  '<div class="iosUi-profile-role">' + esc(user.title || 'Operator') + '</div>' +
                '</div>' +
              '</div>';
    }

    html += '<div class="iosUi-nav">';
    (cfg.menu || []).forEach(function (item, i) {
      html += this.$itemHtml(item, i);
    }, this);
    html += '</div>';

    if (props.getValue('showLogoutButton')) {
      html += '<div class="iosUi-side-foot"><div class="iosUi-item"><div class="iosUi-link" ' +
              'data-ord="' + esc(props.getValue('logoutUrl')) + '">' + svg('bx-log-out') +
              '<span class="iosUi-label">Sign Out</span></div></div></div>';
    }
    html += '</nav>';
    return html;
  };

  IosSideBarWidget.prototype.$itemHtml = function (item, i) {
    if (item.li === 'divider') { return '<div class="iosUi-divider"></div>'; }

    var subs = item.dropDownLink || [],
        link = normLink(item.link),
        text = itemText(item),
        html = '<div class="iosUi-item' + (item.active ? ' is-active' : '') +
               (item.expanded ? ' is-expanded' : '') + '" data-i="' + i + '">';

    html += '<div class="iosUi-link" data-ord="' + esc(link ? link.ord : '') +
            '" data-target="' + esc(link ? link.target : '') + '">';
    html += svg(item.icon);
    html += '<span class="iosUi-label">' + esc(text) + '</span>';
    if (item.badge) { html += '<span class="iosUi-badge">' + esc(item.badge) + '</span>'; }
    if (subs.length) { html += svg('bx-chevron', 'iosUi-ic iosUi-chev'); }
    html += '</div>';

    if (subs.length) {
      html += '<div class="iosUi-sub">';
      subs.forEach(function (s) {
        if (s.li === 'divider') { html += '<div class="iosUi-divider"></div>'; return; }
        var sl = normLink(s.link);
        html += '<div class="iosUi-sublink' + (s.active ? ' is-active' : '') +
                '" data-ord="' + esc(sl ? sl.ord : '') + '">' + esc(itemText(s)) + '</div>';
      });
      html += '</div>';

      // collapsed-state hover flyout, same content
      html += '<div class="iosUi-flyout"><div class="iosUi-flyout-title">' + esc(text) + '</div>';
      subs.forEach(function (s) {
        if (s.li === 'divider') { html += '<div class="iosUi-divider"></div>'; return; }
        var sl = normLink(s.link);
        html += '<div class="iosUi-sublink" data-ord="' + esc(sl ? sl.ord : '') + '">' +
                esc(itemText(s)) + '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  };

  /** Wire hover-expand, submenu slide and ORD navigation. */
  IosSideBarWidget.prototype.$wire = function (root) {
    var that = this;

    root.addEventListener('click', function (ev) {
      var link = ev.target.closest('.iosUi-link'),
          sub = ev.target.closest('.iosUi-sublink'),
          item;

      if (sub) { that.$navigate(sub.getAttribute('data-ord')); return; }
      if (!link) { return; }

      item = link.parentNode;
      if (item.querySelector('.iosUi-sub')) {
        item.classList.toggle('is-expanded');
        // remember the opened branch, as the Works Software menu does
        that.$openIndex = item.classList.contains('is-expanded') ? item.getAttribute('data-i') : null;
      }
      root.querySelectorAll('.iosUi-item').forEach(function (n) { n.classList.remove('is-active'); });
      item.classList.add('is-active');
      that.$navigate(link.getAttribute('data-ord'), link.getAttribute('data-target'));
    });

    var burger = root.querySelector('.iosUi-hamburger');
    if (burger) {
      burger.addEventListener('click', function () { root.classList.toggle('is-open'); });
    }
  };

  /**
   * Navigate to a station ORD. In a browser profile the ux runtime serves
   * PX views under /ord/, so an ORD like station:|slot:/Drivers/AHU1
   * becomes /ord/station:%7Cslot:/Drivers/AHU1.
   */
  IosSideBarWidget.prototype.$navigate = function (ord, target) {
    if (!ord) { return; }
    var url = ord.indexOf('/') === 0 ? ord : '/ord/' + encodeURIComponent(ord).replace(/%3A/g, ':');
    if (target && target !== 'self') { window.open(url, target === 'blank' ? '_blank' : target); }
    else { window.location.href = url; }
  };

  IosSideBarWidget.prototype.doDestroy = function () {
    if (this.$dom) { (this.$dom[0] || this.$dom).innerHTML = ''; }
    return Promise.resolve();
  };

  return IosSideBarWidget;
});
