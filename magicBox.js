/** 
 * @module magicBox
 */ 
(function(name, context, definition) {
    if(typeof module !== 'undefined' && module.exports) module.exports = definition();
    else if(typeof define === 'function' && define.amd) define(definition);
    else context[name] = definition();
})('MagicBox', this, function() {
    function is(t, o) {
        if(type(t) == 'function') return o instanceof t;
        t = t.toLowerCase();
        return type(o) === t;
    }

    function type(o) {
        if(o !== undefined && o.nodeType && o.nodeType == 1) return 'element';
        return Object.prototype.toString.call(o).toLowerCase().slice(8, -1);
    }

    function inDom(e) {
        for(var tmp = e; tmp && tmp.nodeType == 1; tmp = tmp.parentNode) {
            if(tmp.tagName.toLowerCase() == 'body') return true;
        }
        return false;
    }

    function limit(n, l, h) {
        if(n < l) n = l;
        if(n > h) n = h;
        return n;
    }

    function isPath(s) {
        return !!(s.indexOf('/') > -1 || s.match(/\w+\.\w+$/));
    }

    /**
     * Parse query string
     *
     * @param {String} o Query string
     * @return {Object} Object representing key-value query string parameters
     */
    function parseOpts(o) {
        var r = /([^&=]+)=?([^&]*)/g;
        var opts = {};
        var e;
        while (e = r.exec(o)) {
            opts[e[1]] = e[2];
        }
        return opts;
    }

    var opts = parseOpts(window.location.search.substring(1));
    var debug = opts.debug !== undefined ? true : false;

    // allow console call on debug
    var console = debug ? window.console : { log: function() {} };

    var defaults = {
        /**
         * Time (ms) for DOM poll events
         * @property pollTime
         * @for MagicBox
         * @type Number
         * @default 66
         */
        pollTime: 66
    };

    function defaultHandler(n, f) { console.log('handler', f); if(f) f(); }

    var events = {
        /**
         * Called on show() method
         * @event onShow
         * @for MagicBox
         * @param {Function} f Function to call on completion
         * @example 
         *      magicBoxInstance.setHandler('onShow', function(f) {
         *          // show was called, so do something here and then call the
         *          // callback (f)
         *          var that = this; // this is the MagicBox instance
         *          setTimeout( function() {
         *              document.getElementsByTagName('body')[0].appendChild(that.box());
         *              f(); // callback to perform onVisible() handler
         *          }, 1000);
         *      }
         */
        onShow: defaultHandler,
        /**
         * Called on hide() method
         * @event onHide
         * @for MagicBox
         * @param {Function} f Function to call on completion
         * @example 
         *      magicBoxInstance.setHandler('onHide', function(f) {
         *          // hide was called, so do something here and then call the
         *          // callback (f)
         *          var that = this; // this is the MagicBox instance
         *          setTimeout( function() {
         *              that.box().parentNode.removeChild(that.box());
         *              f(); // callback to perform onHidden() handler
         *          }, 1000);
         *      }
         */
        onHide: defaultHandler,
        /**
         * Manual call when show() complete
         * @event onVisible
         * @for MagicBox
         */
        onVisible: defaultHandler,
        /**
         * Manual call when hide() complete
         * @event onHidden
         * @for MagicBox
         */
        onHidden: defaultHandler,
        /**
         * Called when box is inserted into the dom
         * @event onInserted
         * @for MagicBox
         * @example
         *      magicBoxInstance.setHandler('onInserted', function() {
         *          // box is in the DOM
         *          this.hide();
         *          this.box().style.width = "10000px"; // super big!
         *          this.show();
         *      }
         */
        onInserted: null,
        /**
         * Called when box is removed from the dom
         * @event onRemoved
         * @for MagicBox
         * @example
         *      magicBoxInstance.setHandler('onRemoved', function() {
         *          // box is removed from the DOM
         *          alert("Don't remove " + this.box().tagName + " please!");
         *      }
         */
        onRemoved: null
    };

    /**
     * The MagicBox class.  Wraps an element with Magic Box properties!
     *
     *      // the context for all events is the MagicBox instance, so:
     *      magicBoxInstance.setHandler('onVisible', function() {
     *          // 'this' is the magicBoxInstance
     *          this.hide();                                    // hide it
     *          this.box().parentNode.removeChild(this.box());  // remove it
     *      });
     *
     * @class MagicBox
     * @constructor
     * @param {Element} el Element
     * @param {Object} [settings] Settings
     */
    function MagicBox(el, settings) {
        if(!el || !is('element', el)) 
            throw new Error("Magic Box constructor: element required as first argument");

        /**
         * The (now) Magic element
         * @property _el
         * @private
         */
        this._el = el;
        /**
         * Grouped Magic Boxes
         * @property _group
         * @private
         */
        this._grouped = [];
        /**
         * Whether box is visible
         * @property _visible
         * @private
         */
        this._visible = false;

        // set default settings
        for(var p in defaults) 
            this[p] = (settings && settings[p] !== undefined) ? settings[p] : defaults[p];

        // set event placeholders
        for(var e in events)
            this[e] = events[e];
    }

    MagicBox.prototype = {
        /**
         * Start the DOM poller
         *
         * @method _initPoller
         * @chainable
         * @private
         */
        _initPoller: function() {
            if(this['_poller'] !== undefined) return this;

            /**
             * DOM insertion poller.  This property is only created if an
             * {{#crossLink "MagicBox/onInserted:event"}}{{/crossLink}} or
             * {{#crossLink "MagicBox/onRemoved:event"}}{{/crossLink}} handler
             * is set.
             * @property _poller
             * @for MagicBox
             * @private
             */
            this['_poller'] = null;
            /**
             * Whether element is in the DOM.  This property is only created
             * if an {{#crossLink "MagicBox/onInserted:event"}}{{/crossLink}}
             * or {{#crossLink "MagicBox/onRemoved:event"}}{{/crossLink}}
             * handler is set
             * @property _inserted
             * @for MagicBox
             * @private
             */
            this._inserted = inDom(this._el);

            var e = this._el;
            var that = this;

            this['_poller'] = setInterval( function() {
                var s = inDom(e);
                if(s != that._inserted) {
                    that._inserted = s;
                    if(s) that.onInserted && that.onInserted();
                    else  that.onRemoved  && that.onRemoved();
                }
            }, this.pollTime);

            return this;
        },

        /**
         * Get the Magic Box element!
         *
         * @method box
         * @return {Element} The Magic Box element
         */
        box: function() {
            return this._el;
        },

        /**
         * Set an event handler
         *
         * @method setHandler
         * @chainable
         * @param {String} h Event handler name
         * @param {Function} f Event handler
         */
        setHandler: function(h, f) {
            if(events[h] === undefined || !is('function', f)) return this;
            this[h] = f;
            if(h == 'onInserted' || h == 'onRemoved') this._initPoller();
            return this;
        },

        /**
         * Add Magic Boxes to this group
         *
         * @method group
         * @chainable
         * @param {MagicBox|Array} box A Magic Box or array of Magic Boxes!
         */
        group: function(box) {
            if(is('array', box)) {
                for(var i = 0; i < box.length; i++) this.group(box[i]);
            } else if(is(MagicBox, box)) {
                this._grouped.push(box);
            }
            return this;
        },

        /**
         * Get grouped Magic Boxes!
         *
         * @method grouped
         * @param {Number|Array} [l] Grouped item number or low range or numbers
         * @param {Number} [h] High range
         */
        grouped: function(l, h) {
            var n = this._grouped.length;
            if(!n) return [];

            if(is('number', l)) {
                l = limit(l, 0, n - 1);

                if(is('number', h)) {
                    h = limit(h, 0, n - 1);
                    if(l > h) { t = h; h = l; l = t; }
                } else {
                    h = l;
                }

                var vs = [];
                for(var i = l; i <= h; i++) vs.push(this._grouped[i]);

                return vs;
            } else if(is('array', l)) {
                var vs = [];
                for(var i = 0, ll = l.length; i < ll; i++) {
                    var k = limit(l[i], 0, n - 1);
                    vs.push(this._grouped[k]);
                }
                return vs;
            } else {
                return this._grouped;
            }
        },

        /**
         * Show me the Magic Box!
         *
         * @method show
         * @chainable
         */
        show: function() {
            if(this._visible) return this;

            var that = this;
            this.onShow(function() { 
                that._visible = true;
                that.onVisible(); 
            });
            return this;
        },

        /**
         * Put the content back into the Magic Box!
         *
         * @method hide
         * @chainable
         */
        hide: function() {
            if(!this._visible) return this;

            var that = this;
            this.onHide(function() { 
                that._visible = false;
                that.onHidden(); 
            });
            return this;
        }
    };

    return MagicBox;
});
