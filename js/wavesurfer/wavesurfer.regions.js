'use strict';

/* Regions manager */
WaveSurfer.Regions = {
    init: function (wavesurfer) {
        this.wavesurfer = wavesurfer;
        this.wrapper = this.wavesurfer.drawer.wrapper;

        /* Id-based hash of regions. */
        this.list = {};
		var my = this;


		this.wrapper.addEventListener('mouseleave', function (e) { 
			var evt = document.createEvent("MouseEvents");
			evt.initEvent("mouseup", true, true);
			document.body.dispatchEvent(evt);	
		});	
	
		this.on('del', function() {
			for(var reg in my.list) {
				my.list[reg].fireEvent('del');
			}
		});

	},
	

    add: function (params) {
		if(params.data.type=='slice') { 
			var ms = (params.threshold== -1) ? 0.007 : 0.05; // manually or algorithmically added
			var right = this.getTimeAtNextSliceMarker(params.start, 1);
			var left = this.getTimeAtNextSliceMarker(params.start, -1);
			if(params.start - left < ms || right - params.start < ms) {
				return;  
				// do not put one flush next to another one but have at least 7ms gap, or 50ms if auto-detecting transients	
			}
		}
        var region = Object.create(WaveSurfer.Region);
        region.init(params, this.wavesurfer);

        this.list[region.id] = region;
        region.on('remove', (function () {
            delete this.list[region.id];
        }).bind(this));
		
        region.on('update-end', (function (id, px, delta) {
		   	if(this.list[id].data.type=='slice') {
			   this.list[id].threshold = -1; // user obviously 'wanted' that one if they moved it, so we keep it from getting culled by slider 
			   this.wavesurfer.updatePoolData(this.list[id].id, this.list[id].start, this.list[id].threshold);
			   for(var reg in this.list) { // check for positional duplicates
				  if(this.list[reg].pixelPos == px && this.list[reg].id != id && this.list[reg].data.type == 'slice') {
					  this.list[reg].remove();
				  } 
			   }
			}   
			
			else {  // moved L or R locator
				if(this.list[id].id == "lloc" && this.list[id].start >= this.list['rloc'].start) {
					this.list[id].start = this.list['rloc'].start;
					this.list[id].update({start: this.list[id].start, end: this.list[id].start});	
					delta = -delta;					
				}
				if(this.list[id].id == "rloc" && this.list[id].start <= this.list['lloc'].start) {
					this.list[id].start = this.list['lloc'].start;
					this.list[id].update({start: this.list[id].start, end: this.list[id].start});	
					delta = -delta;					
				}	
				if(this.hasSliceMarkers()) { // quantise movement to slices
					this.list[id].start = this.getTimeAtNextSliceMarker(this.list[id].start, delta);
					this.list[id].update({start: this.list[id].start, end: this.list[id].start});
				}
			}
			
        }).bind(this));	
	
        return region;
    },

    /* Remove all regions. */
    clear: function () {
        Object.keys(this.list).forEach(function (id) {
            this.list[id].remove();
        }, this);
    },

	
	getTimeAtLeftLocator: function() {
	return this.list['lloc'].start;
	},

	getTimeAtRightLocator: function() {
	return this.list['rloc'].start;
	},
	
	hasSliceMarkers: function() {
		var hsm = false;
		for(var reg in this.list) {
			if(this.list[reg].data.type == ['slice']) {
				hsm = true;
				break;
			}
		}
		return hsm;
	},


	getSlicesBetweenLocators: function() {
		if(this.list['lloc'].start >= this.list['rloc'].start) return 0;
		var sl = 1; // there must be at least 1 if only the one between L/R
		for(var reg in this.list) {
			if(this.list[reg].data.type == ['slice'] && this.list[reg].start > this.list['lloc'].start && this.list[reg].start < this.list['rloc'].start) {
				sl +=1;
			}
		}
		return sl;
	},

	
	getTimeAtNextSliceMarker: function(pos, dir) {
		var c = dir > 0 ? wavesurfer.getDuration() : 0;
		if(dir > 0)	{
			for(var reg in this.list) {
				//if(this.list[reg].data.type == ['slice'] && this.list[reg].start > pos && this.list[reg].start < c) {  // dir = gtr than
				 if(this.list[reg].start > pos && this.list[reg].start < c) {  // dir = gtr than
					c = this.list[reg].start;	
				}
			}
		}
		else if(dir < 0) {
			for(var reg in this.list) {
				//if(this.list[reg].data.type == ['slice'] && this.list[reg].start < pos && this.list[reg].start > c) {  // dir = less than
				if(this.list[reg].start < pos && this.list[reg].start > c) {  // dir = gtr than
					c = this.list[reg].start;	
				}
			}
		}
		
		else {
				
			
		}
		return c;	
	},
	
	clearRegionPositions: function() {
		for(var reg in this.list) {
			    this.list[reg].style(this.list[reg].element, {
 				left: '0px',
				width: '0px',
                backgroundColor: 'transparent',
             });	
		}
	},
	
	removeItemsAbove: function(threshold) {
		for(var reg in this.list) {
			if(this.list[reg].threshold > threshold) {
				this.list[reg].remove();
			}
		}
	},

	addItemsBelowOrEqual: function(threshold, oldThreshold) {
		var ar = this.wavesurfer.searchTransientPool(threshold, oldThreshold);
		for(var t=0; t < ar.length; t++) {
			this.add({
				id: ar[t].id,
				start: ar[t].start,
				end: ar[t].start,
				color: 'rgba(0, 255, 0, 0.4)',
				data: {type: 'slice'},
				threshold: ar[t].threshold,
				drag: true,
				resize: false
			});
		}
	},	

	nudgeAll: function(dir) {
		for(var reg in this.list) {
			if(this.list[reg].data.type == 'slice') {
				var delta = 0.003 * dir;
				this.list[reg].update({
					start: this.list[reg].start + delta,
					end: this.list[reg].end + delta
					});		
			}
		}
	
	},
	
    enableDragSelection: function (params) {
        var my = this;
        var drag;
        var start;
        var region;

        function eventDown(e) {
            drag = true;
            if (typeof e.targetTouches !== 'undefined' && e.targetTouches.length === 1) {
                e.clientX = e.targetTouches[0].clientX;
            }
            start = my.wavesurfer.drawer.handleEvent(e);
            region = null;
        }
        this.wrapper.addEventListener('mousedown', eventDown);
        this.wrapper.addEventListener('touchstart', eventDown);
        function eventUp(e) {
            drag = false;

            if (region) {
                region.fireEvent('update-end', e);
                my.wavesurfer.fireEvent('region-update-end', region, e);
            }

            region = null;
        }
        this.wrapper.addEventListener('mouseup', eventUp);
        this.wrapper.addEventListener('touchend', eventUp);
        function eventMove(e) {
            if (!drag) { return; }

            if (!region) {
                region = my.add(params || {});
            }

            var duration = my.wavesurfer.getDuration();
            if (typeof e.targetTouches !== 'undefined' && e.targetTouches.length === 1) {
                e.clientX = e.targetTouches[0].clientX;
            }
            var end = my.wavesurfer.drawer.handleEvent(e);
            region.update({
                start: Math.min(end * duration, start * duration),
                end: Math.max(end * duration, start * duration)
            });
        }
        this.wrapper.addEventListener('mousemove', eventMove);
        this.wrapper.addEventListener('touchmove', eventMove);
		
    }
};

WaveSurfer.Region = {
    /* Helper function to assign CSS styles. */
    style: WaveSurfer.Drawer.style,

    init: function (params, wavesurfer) {
        this.wavesurfer = wavesurfer;
        this.wrapper = wavesurfer.drawer.wrapper;

        this.id = params.id == null ? WaveSurfer.util.getId() : params.id;
        this.start = Number(params.start) || 0;
        this.end = params.end == null ?
            // small marker-like region
            this.start + (4 / this.wrapper.scrollWidth) * this.wavesurfer.getDuration() :
            Number(params.end);
        this.resize = params.resize === undefined ? true : Boolean(params.resize);
        this.drag = params.drag === undefined ? true : Boolean(params.drag);
        this.loop = Boolean(params.loop);
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
        this.data = params.data || {};
        this.attributes = params.attributes || {};
		
		this.threshold = params.threshold || this.wavesurfer.getThreshold();

        this.maxLength = params.maxLength;
        this.minLength = params.minLength;

        this.bindInOut();
        this.render();
        this.wavesurfer.on('zoom', this.updateRender.bind(this));
        this.wavesurfer.fireEvent('region-created', this);
		var my = this;
		this.on('del', function() {
			if(my.inRegion == true && my.data.type == 'slice') {
				my.remove();
				my.wavesurfer.removeFromPool(my.id);
			}
		});
    },

    /* Update region params. */
    update: function (params) {
        if (null != params.start) {
            this.start = Number(params.start);
        }
        if (null != params.end) {
            this.end = Number(params.end);
        }
        if (null != params.loop) {
            this.loop = Boolean(params.loop);
        }
        if (null != params.color) {
            this.color = params.color;
        }
        if (null != params.data) {
            this.data = params.data;
        }
        if (null != params.resize) {
            this.resize = Boolean(params.resize);
        }
        if (null != params.drag) {
            this.drag = Boolean(params.drag);
        }
        if (null != params.maxLength) {
            this.maxLength = Number(params.maxLength);
        }
        if (null != params.minLength) {
            this.minLength = Number(params.minLength);
        }
        if (null != params.attributes) {
            this.attributes = params.attributes;
        }

        this.updateRender();
        this.fireEvent('update');
        this.wavesurfer.fireEvent('region-updated', this);
    },

    /* Remove a single region. */
    remove: function (region) {
        if (this.element) {
            this.wrapper.removeChild(this.element);
            this.element = null;
            this.fireEvent('remove');
            this.wavesurfer.un('zoom', this.updateRender.bind(this));
            this.wavesurfer.fireEvent('region-removed', this);
        }
    },

    /* Play the audio region. */
    play: function () {
        this.wavesurfer.play(this.start, this.end);
        this.fireEvent('play');
        this.wavesurfer.fireEvent('region-play', this);
    },

    /* Play the region in loop. */
    playLoop: function () {
        this.play();
        this.once('out', this.playLoop.bind(this));
    },

    /* Render a region as a DOM element. */
    render: function () {
        var regionEl = document.createElement('region');
        regionEl.className = 'wavesurfer-region';
       // regionEl.title = this.formatTime(this.start, this.end);
        regionEl.setAttribute('data-id', this.id);

        for (var attrname in this.attributes) {
            regionEl.setAttribute('data-region-' + attrname, this.attributes[attrname]);
        }

        var width = this.wrapper.scrollWidth;
        this.style(regionEl, {
            position: 'absolute',
            zIndex: this.data.type == 'slice' ? 2:3,
            height: '100%',
            top: '0px'
        });

        /* Resize handles */
  /*    if (this.resize) {
            var handleLeft = regionEl.appendChild(document.createElement('handle'));
            var handleRight = regionEl.appendChild(document.createElement('handle'));
            handleLeft.className = 'wavesurfer-handle wavesurfer-handle-start';
            handleRight.className = 'wavesurfer-handle wavesurfer-handle-end';
            var css = {
                cursor: 'col-resize',
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: '1%',
                maxWidth: '4px',
                height: '100%'
            };
            this.style(handleLeft, css);
            this.style(handleRight, css);
            this.style(handleRight, {
                left: '100%'
            });
        }
*/
		
		if(this.data.type == 'lLocator') {
			this.style(regionEl, {
				'border-top': '5px solid red',
				'border-right': '5px solid transparent',
				'border-left': '2px solid red'
			});			
		}
		
		if(this.data.type == 'rLocator') {
			this.style(regionEl, {
				'border-top': '5px solid red',
				'border-left': '5px solid transparent',
				'border-right': '2px solid red'
			});	
		}
		
        this.element = this.wrapper.appendChild(regionEl);
        this.updateRender();
        this.bindEvents(regionEl);
    },

    formatTime: function (start, end) {
        return (start == end ? [ start ] : [ start, end ]).map(function (time) {
            return [
                Math.floor((time % 3600) / 60), // minutes
                ('00' + Math.floor(time % 60)).slice(-2) // seconds
            ].join(':');
        }).join('-');
    },

    /* Update element's position, width, color. */
    updateRender: function () {
		var rightScrollZone = 878;
		var leftScrollZone = 22;
        var dur = this.wavesurfer.getDuration();
        var width = this.wrapper.scrollWidth;
		this.pixelPos = ~~(this.start / dur * width);
		var relPos = this.pixelPos  - this.wrapper.scrollLeft;
		
		if(this.delta > 0 && relPos > rightScrollZone && (this.wrapper.scrollLeft + this.wrapper.clientWidth) < this.wrapper.scrollWidth) {
			// advance scrollbar as element is being dragged (to the right)
			var n = this.wrapper.scrollLeft + 20;
			if(n > this.wrapper.scrollWidth - this.wrapper.clientWidth) {
				n = this.wrapper.scrollWidth - this.wrapper.clientWidth;
			}
			this.wrapper.scrollLeft = n;
		}

		if(this.delta < 0 && relPos < leftScrollZone && this.wrapper.scrollLeft > 0) {
			// advance scrollbar as element is being dragged (to the left)
			var n = this.wrapper.scrollLeft - 20;
			if(n < 0) {
				n = 0;
			}
			this.wrapper.scrollLeft = n;
		}

        if (this.start < 0) {
          this.start = 0;
          this.end = this.end - this.start;
        }
        if (this.end > dur) {
          this.end = dur;
          this.start = dur - (this.end - this.start);
        }

        if (this.minLength != null) {
            this.end = Math.max(this.start + this.minLength, this.end);
        }

        if (this.maxLength != null) {
            this.end = Math.min(this.start + this.maxLength, this.end);
        }

        if (this.element != null) {
			if(this.data.type == 'slice' || this.data.type == 'rLocator') {
				if(this.pixelPos > (this.wrapper.scrollWidth - 2)) { 
					this.pixelPos = this.wrapper.scrollWidth - 2;
				}
			}
			else {
				if(this.pixelPos > (this.wrapper.scrollWidth - 7)) { 
					this.pixelPos = this.wrapper.scrollWidth - 7;
				}			
			}
			
		if(this.data.type == 'rLocator') {		
			this.pixelPos -=5;  // lines up with the slice markers visually as well as temporally 
								// plus the extra -2 px offset above means it won't stray outside bounding scrollWidth
		}
		
		if(this.pixelPos < 0) this.pixelPos = 0;
		if(this.start < 0) this.start = 0;
		if(this.start > this.wavesurfer.getDuration()) this.start = this.wavesurfer.getDuration();
		
            this.style(this.element, {
				left: this.pixelPos + 'px',
				width: this.data.type == 'slice' ? '2px': '0px',
                backgroundColor: this.color,
                cursor: this.drag ? 'move' : 'default'
            });

            for (var attrname in this.attributes) {
                this.element.setAttribute('data-region-' + attrname, this.attributes[attrname]);
            }

           // this.element.title = this.formatTime(this.start, this.end);
        }
    },

    /* Bind audio events. */
    bindInOut: function () {
        var my = this;

        my.firedIn = false;
        my.firedOut = false;

        var onProcess = function (time) {
            if (!my.firedIn && my.start <= time && my.end > time) {
                my.firedIn = true;
                my.firedOut = false;
                my.fireEvent('in');
                my.wavesurfer.fireEvent('region-in', my);
            }
            if (!my.firedOut && my.firedIn && (my.start >= Math.round(time * 100) / 100 || my.end <= Math.round(time * 100) / 100)) {
                my.firedOut = true;
                my.firedIn = false;
                my.fireEvent('out');
                my.wavesurfer.fireEvent('region-out', my);
            }
        };

        this.wavesurfer.backend.on('audioprocess', onProcess);

        this.on('remove', function () {
            my.wavesurfer.backend.un('audioprocess', onProcess);
        });

        /* Loop playback. */
        this.on('out', function () {
            if (my.loop) {
                my.wavesurfer.play(my.start);
            }
        });
    },

    /* Bind DOM events. */
    bindEvents: function () {
        var my = this;

        this.element.addEventListener('mouseenter', function (e) {
			my.inRegion = true;
            my.fireEvent('mouseenter', e);
            my.wavesurfer.fireEvent('region-mouseenter', my, e);
        });

        this.element.addEventListener('mouseleave', function (e) {
			my.inRegion = false;
            my.fireEvent('mouseleave', e);
            my.wavesurfer.fireEvent('region-mouseleave', my, e);
        });

        this.element.addEventListener('click', function (e) {
            e.preventDefault();
			e.stopPropagation();
            my.fireEvent('click', e);
            my.wavesurfer.fireEvent('region-click', my, e);
        });

        this.element.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            e.preventDefault();
            my.fireEvent('dblclick', e);
            my.wavesurfer.fireEvent('region-dblclick', my, e);
        });

		
        /* Drag or resize on mousemove. */
        (this.drag || this.resize) && (function () {
            var duration = my.wavesurfer.getDuration();
            var drag;
            var resize;
            var startTime;

            var onDown = function (e) {
                e.stopPropagation();
                startTime = my.wavesurfer.drawer.handleEvent(e) * duration;

                if (e.target.tagName.toLowerCase() == 'handle') {
                    if (e.target.classList.contains('wavesurfer-handle-start')) {
                        resize = 'start';
                    } else {
                        resize = 'end';
                    }
                } else {
                    drag = true;
                }
            };
            var onUp = function (e) {
                if (drag || resize) {
                    drag = false;
					// update position
                    resize = false;
				    e.preventDefault();
                    e.stopPropagation();
                    //my.fireEvent('update-end', e);  
					my.fireEvent('update-end', my.id, my.pixelPos, my.delta);
		            my.wavesurfer.fireEvent('region-update-end', my, e);
					my.delta = 0;
                }
            };
            var onMove = function (e) {
                if (drag || resize) {
                    var time = my.wavesurfer.drawer.handleEvent(e) * duration;
                    var delta = time - startTime;
                    startTime = time;

                    // Drag
                    if (my.drag && drag) {
                        my.onDrag(delta);
                    }

                    // Resize
                    if (my.resize && resize) {
                        my.onResize(delta, resize);
                    }
                }
            };

            my.element.addEventListener('mousedown', onDown);
            my.wrapper.addEventListener('mousemove', onMove);
            document.body.addEventListener('mouseup', onUp);
			
            my.on('remove', function () {
                document.body.removeEventListener('mouseup', onUp);
                my.wrapper.removeEventListener('mousemove', onMove);
            });

            my.wavesurfer.on('destroy', function () {
                document.body.removeEventListener('mouseup', onUp);
            });
        }());
    },

    onDrag: function (delta) {
		// if positive delta, there may be scrolling needed (if near boundary)
        this.delta = delta;
        this.update({
            start: this.start + delta,
            end: this.end + delta
        });
    },

    onResize: function (delta, direction) {
        if (direction == 'start') {
            this.update({
                start: Math.min(this.start + delta, this.end),
                end: Math.max(this.start + delta, this.end)
            });
        } else {
            this.update({
                start: Math.min(this.end + delta, this.start),
                end: Math.max(this.end + delta, this.start)
            });
        }
    }
};

WaveSurfer.util.extend(WaveSurfer.Region, WaveSurfer.Observer);
WaveSurfer.util.extend(WaveSurfer.Regions, WaveSurfer.Observer);

/* Augment WaveSurfer with region methods. */
WaveSurfer.initRegions = function () {
    if (!this.regions) {
        this.regions = Object.create(WaveSurfer.Regions);
        this.regions.init(this);
    }
};

WaveSurfer.addRegion = function (options) {
    this.initRegions();
    return this.regions.add(options);
};

WaveSurfer.clearRegions = function () {
    this.regions && this.regions.clear();
};

WaveSurfer.enableDragSelection = function (options) {
    this.initRegions();
    this.regions.enableDragSelection(options);
};

WaveSurfer.getTimeAtLeftLocator = function() {
	return this.regions.getTimeAtLeftLocator();
};

WaveSurfer.getTimeAtRightLocator = function() {
	return this.regions.getTimeAtRightLocator();
};

WaveSurfer.hasSliceMarkers = function() {
	return this.regions.hasSliceMarkers();
};

WaveSurfer.getTimeAtNextSliceMarker = function(pos, dir) {
	return this.regions.getTimeAtNextSliceMarker(pos, dir);
};

WaveSurfer.clearRegionPositions = function() {
	this.regions.clearRegionPositions();
};

WaveSurfer.initLR = function() {
	 this.addRegion({	
		id: 'lloc',
		start: 0, // time in seconds
		end: 0, // time in seconds
		color: 'rgba(255, 0, 0, 0.0)',
		data: {type: 'lLocator'},
		threshold: -1000,
		drag: true,
		resize: false
		});		
	
	this.addRegion({	
		id: 'rloc',
		start: this.getDuration(), // time in seconds
		end: this.getDuration(), // time in seconds		
		color: 'rgba(255, 0, 0, 0.0)',
		data: {type: 'rLocator'},
		threshold: -1000,
		drag: true,
		resize: false
		});		
};

WaveSurfer.getThreshold = function() {
	return this.threshold;
};

WaveSurfer.resetThreshold = function() {
	this.threshold = 0;
};

WaveSurfer.setThreshold = function(threshold) {
	var oldThreshold = this.threshold;
	this.threshold = threshold;
	if(this.threshold <= oldThreshold) {
	this.regions.removeItemsAbove(this.threshold);	// lower t-number means more prominent 
	}												// so 'lower means higher' 
	if(this.threshold > oldThreshold) {
		this.regions.addItemsBelowOrEqual(this.threshold, oldThreshold);
	}
};

WaveSurfer.nudgeAll = function(dir) {
	this.regions.nudgeAll(dir);
};