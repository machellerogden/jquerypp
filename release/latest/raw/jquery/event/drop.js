/*!
* jQuery++ - 1.0.1 (2013-02-08)
* http://jquerypp.com
* Copyright (c) 2013 Bitovi
* Licensed MIT
*/
(function ($) {
	var event = $.event;

	var eventNames = [

	"dropover",

	"dropon",

	"dropout",

	"dropinit",

	"dropmove",

	"dropend"];


	$.Drop = function (callbacks, element) {
		$.extend(this, callbacks);
		this.element = $(element);
	}
	// add the elements ...
	$.each(eventNames, function () {
		event.special[this] = {
			add: function (handleObj) {
				//add this element to the compiles list
				var el = $(this),
					current = (el.data("dropEventCount") || 0);
				el.data("dropEventCount", current + 1)
				if (current == 0) {
					$.Drop.addElement(this);
				}
			},
			remove: function () {
				var el = $(this),
					current = (el.data("dropEventCount") || 0);
				el.data("dropEventCount", current - 1)
				if (current <= 1) {
					$.Drop.removeElement(this);
				}
			}
		}
	});

	$.extend($.Drop, {

		lowerName: "drop",
		_rootElements: [],
		//elements that are listening for drops
		_elements: $(),
		//elements that can be dropped on
		last_active: [],
		endName: "dropon",
		// adds an element as a 'root' element
		// this element might have events that we need to respond to
		addElement: function (el) {
			// check other elements
			for (var i = 0; i < this._rootElements.length; i++) {
				if (el == this._rootElements[i]) return;
			}
			this._rootElements.push(el);
		},
		removeElement: function (el) {
			for (var i = 0; i < this._rootElements.length; i++) {
				if (el == this._rootElements[i]) {
					this._rootElements.splice(i, 1)
					return;
				}
			}
		},

		sortByDeepestChild: function (a, b) {
			// Use jQuery.compare to compare two elements
			var compare = a.element.compare(b.element);
			if (compare & 16 || compare & 4) return 1;
			if (compare & 8 || compare & 2) return -1;
			return 0;
		},

		isAffected: function (point, moveable, responder) {
			return ((responder.element != moveable.element) && (responder.element.within(point[0], point[1], responder._cache).length == 1));
		},

		deactivate: function (responder, mover, event) {
			mover.out(event, responder)
			responder.callHandlers(this.lowerName + 'out', responder.element[0], event, mover)
		},

		activate: function (responder, mover, event) { //this is where we should call over
			mover.over(event, responder)
			responder.callHandlers(this.lowerName + 'over', responder.element[0], event, mover);
		},
		move: function (responder, mover, event) {
			responder.callHandlers(this.lowerName + 'move', responder.element[0], event, mover)
		},

		compile: function (event, drag) {
			// if we called compile w/o a current drag
			if (!this.dragging && !drag) {
				return;
			} else if (!this.dragging) {
				this.dragging = drag;
				this.last_active = [];
			}
			var el, drops, selector, dropResponders, newEls = [],
				dragging = this.dragging;

			// go to each root element and look for drop elements
			for (var i = 0; i < this._rootElements.length; i++) { //for each element
				el = this._rootElements[i]

				// gets something like {"": ["dropinit"], ".foo" : ["dropover","dropmove"] }
				var drops = $.event.findBySelector(el, eventNames)

				// get drop elements by selector
				for (selector in drops) {
					dropResponders = selector ? jQuery(selector, el) : [el];

					// for each drop element
					for (var e = 0; e < dropResponders.length; e++) {

						// add the callbacks to the element's Data
						// there already might be data, so we merge it
						if (this.addCallbacks(dropResponders[e], drops[selector], dragging)) {
							newEls.push(dropResponders[e])
						};
					}
				}
			}
			// once all callbacks are added, call init on everything ...
			this.add(newEls, event, dragging)
		},

		// adds the drag callbacks object to the element or merges other callbacks ...
		// returns true or false if the element is new ...
		// onlyNew lets only new elements add themselves
		addCallbacks: function (el, callbacks, onlyNew) {
			var origData = $.data(el, "_dropData");
			if (!origData) {
				$.data(el, "_dropData", new $.Drop(callbacks, el));
				return true;
			} else if (!onlyNew) {
				var origCbs = origData;
				// merge data
				for (var eventName in callbacks) {
					origCbs[eventName] = origCbs[eventName] ? origCbs[eventName].concat(callbacks[eventName]) : callbacks[eventName];
				}
				return false;
			}
		},
		// calls init on each element's drags. 
		// if its cancelled it's removed
		// adds to the current elements ...
		add: function (newEls, event, drag, dragging) {
			var i = 0,
				drop;

			while (i < newEls.length) {
				drop = $.data(newEls[i], "_dropData");
				drop.callHandlers(this.lowerName + 'init', newEls[i], event, drag)
				if (drop._canceled) {
					newEls.splice(i, 1)
				} else {
					i++;
				}
			}
			this._elements.push.apply(this._elements, newEls)
		},
		show: function (point, moveable, event) {
			var element = moveable.element;
			if (!this._elements.length) return;

			var respondable, affected = [],
				propagate = true,
				i = 0,
				j, la, toBeActivated, aff, oldLastActive = this.last_active,
				responders = [],
				self = this,
				drag;

			// what's still affected ... we can also move element out here
			while (i < this._elements.length) {
				drag = $.data(this._elements[i], "_dropData");

				if (!drag) {
					this._elements.splice(i, 1)
				}
				else {
					i++;
					if (self.isAffected(point, moveable, drag)) {
						affected.push(drag);
					}
				}
			}

			// we should only trigger on lowest children
			affected.sort(this.sortByDeepestChild);
			event.stopRespondPropagate = function () {
				propagate = false;
			}

			toBeActivated = affected.slice();

			// all these will be active
			this.last_active = affected;

			// deactivate everything in last_active that isn't active
			for (j = 0; j < oldLastActive.length; j++) {
				la = oldLastActive[j];
				i = 0;
				while ((aff = toBeActivated[i])) {
					if (la == aff) {
						toBeActivated.splice(i, 1);
						break;
					} else {
						i++;
					}
				}
				if (!aff) {
					this.deactivate(la, moveable, event);
				}
				if (!propagate) return;
			}
			for (var i = 0; i < toBeActivated.length; i++) {
				this.activate(toBeActivated[i], moveable, event);
				if (!propagate) return;
			}

			// activate everything in affected that isn't in last_active
			for (i = 0; i < affected.length; i++) {
				this.move(affected[i], moveable, event);

				if (!propagate) return;
			}
		},
		end: function (event, moveable) {
			var la, endName = this.lowerName + 'end',
				onEvent = $.Event(this.endName, event),
				dropData;

			// call dropon
			// go through the actives ... if you are over one, call dropped on it
			for (var i = 0; i < this.last_active.length; i++) {
				la = this.last_active[i]
				if (this.isAffected(event.vector(), moveable, la) && la[this.endName]) {
					la.callHandlers(this.endName, null, onEvent, moveable);
				}

				if (onEvent.isPropagationStopped()) {
					break;
				}
			}
			// call dropend
			for (var r = 0; r < this._elements.length; r++) {
				dropData = $.data(this._elements[r], "_dropData");
				dropData && dropData.callHandlers(endName, null, event, moveable);
			}

			this.clear();
		},

		clear: function () {
			this._elements.each(function () {
				// remove temporary drop data
				$.removeData(this, "_dropData")
			})
			this._elements = $();
			delete this.dragging;
		}
	})
	$.Drag.responder = $.Drop;

	$.extend($.Drop.prototype, {

		callHandlers: function (method, el, ev, drag) {
			var length = this[method] ? this[method].length : 0
			for (var i = 0; i < length; i++) {
				this[method][i].call(el || this.element[0], ev, this, drag)
			}
		},

		cache: function (value) {
			this._cache = value != null ? value : true;
		},

		cancel: function () {
			this._canceled = true;
		}
	});

	return $;
})(jQuery);