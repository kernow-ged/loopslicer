/*!
@license
 * wavesurfer.js
 *
 * https://github.com/katspaugh/wavesurfer.js
 *
 * This work is licensed under a Creative Commons Attribution 3.0 Unported License.
 */

'use strict';

var WaveSurfer = {
    defaultParams: {
        height        : 128,
        waveColor     : '#999',
        progressColor : '#555',
        cursorColor   : '#333',
        cursorWidth   : 1,
        skipLength    : 2,
        minPxPerSec   : 20,
        pixelRatio    : window.devicePixelRatio,
        fillParent    : true,
        scrollParent  : false,
        hideScrollbar : false,
        normalize     : false,
        audioContext  : null,
        container     : null,
        dragSelection : true,
        loopSelection : true,
        audioRate     : 1,
        interact      : true,
        splitChannels : false,
        mediaContainer: null,
        mediaControls : false,
        renderer      : 'Canvas',
        backend       : 'WebAudio',
        mediaType     : 'audio',
        autoCenter    : true
    },

    init: function (params) {
        // Extract relevant parameters (or defaults)
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.container = 'string' == typeof params.container ?
            document.querySelector(this.params.container) :
            this.params.container;

        if (!this.container) {
            throw new Error('Container element not found');
        }

        if (this.params.mediaContainer == null) {
            this.mediaContainer = this.container;
        } else if (typeof this.params.mediaContainer == 'string') {
            this.mediaContainer = document.querySelector(this.params.mediaContainer);
        } else {
            this.mediaContainer = this.params.mediaContainer;
        }

        if (!this.mediaContainer) {
            throw new Error('Media Container element not found');
        }

        // Used to save the current volume when muting so we can
        // restore once unmuted
        this.savedVolume = 0;
        // The current muted state
        this.isMuted = false;
        // Will hold a list of event descriptors that need to be
        // cancelled on subsequent loads of audio
        this.tmpEvents = [];

        this.createDrawer();
        this.createBackend();
		this.createFilemaker();
    },

    createDrawer: function () {
        var my = this;

        this.drawer = Object.create(WaveSurfer.Drawer[this.params.renderer]);
        this.drawer.init(this.container, this.params);

        this.drawer.on('redraw', function () {
            my.drawBuffer();
            my.drawer.progress(my.backend.getPlayedPercents());
        });

        // Click-to-seek
        this.drawer.on('click', function (e, progress) {
			if(e.shiftKey) {
				if (my.regions) {
					my.addRegion({
						start: progress * my.getDuration(),
						end: progress * my.getDuration(),
						color: 'rgba(0, 255, 0, 0.4)',	
						data: {type: 'slice'}, 
						threshold: -1,  
						drag: true,
						resize: false					
					});
				}
			}
			else setTimeout(function () {	
				if(my.isPlaying()) my.stop();
				my.seekToAndPlaySingle(progress, false, false, 0);
            }, 0);
			
        });

        // Relay the scroll event from the drawer
        this.drawer.on('scroll', function (e) {
            my.fireEvent('scroll', e);
        });
    },

    createBackend: function () {
        var my = this;

        if (this.backend) {
            this.backend.destroy();
        }

        // Back compat
        if (this.params.backend == 'AudioElement') {
            this.params.backend = 'MediaElement';
        }

        if (this.params.backend == 'WebAudio' && !WaveSurfer.WebAudio.supportsWebAudio()) {
            this.params.backend = 'MediaElement';
        }

        this.backend = Object.create(WaveSurfer[this.params.backend]);
        this.backend.init(this.params);

        this.backend.on('finish', function () { my.fireEvent('finish'); });
        this.backend.on('play', function () { my.fireEvent('play'); });
        this.backend.on('pause', function () { my.fireEvent('pause'); });
		this.backend.on('render', function (e) { my.fireEvent('render', e);});

		
		
        this.backend.on('audioprocess', function (time) {
            my.drawer.progress(my.backend.getPlayedPercents());  
            my.fireEvent('audioprocess', time);
        });
    },


	createFilemaker: function() {
		var my = this;
		this.filemaker = Object.create(WaveSurfer.Filemaker);
		this.filemaker.on('error', function (err) { my.fireEvent('error', err); });
	},


    getDuration: function () {
        return this.backend.getDuration();
    },

    getCurrentTime: function () {
        return this.backend.getCurrentTime();
    },

    play: function (start, end) {
        this.backend.play(start, end);
    },

    playExtended: function (start, loop, end, render, index) {
        this.backend.playExtended(start, loop, end, render, index);
    },	
	
    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        this.backend.isPaused() ? this.play() : this.pause();
    },

    isPlaying: function () {
        return !this.backend.isPaused();
    },

    skipBackward: function (seconds) {
        this.skip(-seconds || -this.params.skipLength);
    },

    skipForward: function (seconds) {
        this.skip(seconds || this.params.skipLength);
    },

    skip: function (offset) {
        var position = this.getCurrentTime() || 0;
        var duration = this.getDuration() || 1;
        position = Math.max(0, Math.min(duration, position + (offset || 0)));
        this.seekAndCenter(position / duration);
    },

    seekAndCenter: function (progress) {
        this.seekTo(progress);
        this.drawer.recenter(progress);
    },

    seekTo: function (progress) {
        var paused = this.backend.isPaused();
        // avoid small scrolls while paused seeking
        var oldScrollParent = this.params.scrollParent;
        if (paused) {
            this.params.scrollParent = false;
        }
        this.backend.seekTo(progress * this.getDuration());
        this.drawer.progress(this.backend.getPlayedPercents());

        if (!paused) {
            this.backend.pause();
           //this.backend.play();
        }
        this.params.scrollParent = oldScrollParent;
        this.fireEvent('seek', progress);
    },

	activeSliceMarkers: [],
	
	tempo: 1.0,
	
	pitch: 1.0,	
	
	speed: 1.0, // overall speed, depends on tempo *and* pitch

	setTempo: function(t) {
		this.tempo = t;
		this.speed = this.tempo * 1.0/this.pitch;
	},
	
	setPitch: function(t) {
		this.pitch = t;
		this.speed = this.tempo * 1.0/this.pitch;
	},
	
	getSliceBoundaries: function(progress, fromLoop) {
		if(progress >= this.getRightLocator() && fromLoop) {
			if(this.getRightLocator() > this.getLeftLocator()) {
			progress = this.getLeftLocator(); 
			}
			else {
				progress = 0;
			}
		}	
 		if(!fromLoop) {
			this.activeSliceMarkers[0] = (this.getTimeAtNextSliceMarker(progress * this.getDuration(), -1));
			this.activeSliceMarkers[0] /= this.getDuration();
		}
		else {
			this.activeSliceMarkers[0] = progress;
		}
		this.activeSliceMarkers[1] = (this.getTimeAtNextSliceMarker((progress * this.getDuration()) + 0.00000000001, 1));	
		// that tiny 0.00000000001 offset is b/c i think rounding errors or something like that caused it to revisit the same slice every now & then 
		// (when in loop mode that is) 
		this.activeSliceMarkers[1] /= this.getDuration();
	},


	getLeftLocator: function() {
		// NB denominated in 0...1 while region methods return abs. time	
	   return this.getTimeAtLeftLocator() / this.getDuration();
	},
	
	getRightLocator: function() {
	    //  NB denominated in 0...1 while region methods return abs. time
	   return this.getTimeAtRightLocator() / this.getDuration();		
	},	

	getSlicesBetweenLocators: function() {
	    return this.regions.getSlicesBetweenLocators();	
	},	
	
	getDurationBetweenLocators: function() {
		return this.getTimeAtRightLocator() - this.getTimeAtLeftLocator();
	},

	
	setEstBpm: function() {
		var time = this.getDurationBetweenLocators();
		var beats = (this.timing.num * this.timing.bars) + this.timing.extrabeats; 
		var timePerBeat = time / beats;
		this.timing.timePerQtrNote = timePerBeat * (this.timing.denom/4);
		this.timing.bpm = (60 / this.timing.timePerQtrNote) * this.tempo;
	},

	getEstBpm: function() {
		return Math.round(this.timing.bpm * 100) / 100;
	},
	
    seekToAndPlaySingle: function(progress, fromLoop, render, index) { 
   		var my = this;
 		this.getSliceBoundaries(progress, fromLoop);
        this.seekTo(this.activeSliceMarkers[0]); 
		this.backend.un('audioprocess');
        this.backend.on('audioprocess', function (time) {
			// we don't want cursor to move past our loop point
            my.drawer.progress(my.backend.getPlayedPercents()); 
            my.fireEvent('audioprocess', time);
        });	
		this.setPlaybackRate(this.pitch);
		var playableSlice = this.activeSliceMarkers[1] - this.activeSliceMarkers[0];
		if(fromLoop == true) playableSlice /= this.speed;
		this.playExtended(this.activeSliceMarkers[0] * this.getDuration(), this.activeSliceMarkers[1] * this.getDuration(), (this.activeSliceMarkers[0] + playableSlice) * this.getDuration(), render, index); 
		my.fromLoop = fromLoop;
		this.once('pause', function() {
			if(my.fromLoop == false) {
				my.seekAndCenter(my.activeSliceMarkers[0]);	
			}
		});		
    },	

 	
	seekToAndPlayAll: function(progress) {
		this.seekToAndPlaySingle(progress, true, false, 0);
		var self = this;
		this.on('pause', function() {
			self.seekToAndPlaySingle(self.activeSliceMarkers[1], true, false, 0);
		});
	},

	segmentIndex: 0,
	
	resetSlices: function() {
		this.backend.resetSlices();
	},
	
	getSlices: function() {
		return(this.backend.getSlices());
	},

	midiScale: 'chromatic',

	noteNumber: 0,
	
	timing: {num: 4, denom: 4, extrabeats: 0, bpm: 0, bars: 1, timePerQtrNote: 0, pitchcomp: 0},
	
	setScale: function(s) {
		this.midiScale = s;
	},
	
	setNoteNumber: function(s) {
		this.noteNumber = s;
	},

	initTiming: function() {
		this.timing.num = 4;
		this.timing.denom = 4;
		this.timing.extrabeats = 0;
		this.timing.bpm = 0;
		this.timing.bars = 1;
		this.timing.timePerQtrNote = 0;
		this.timing.pitchcomp = 0;
	},

	setTimingNum: function(num) {
		this.timing.num = parseInt(num);		
	},

	setTimingDenom: function(denom) {
		this.timing.denom = parseInt(denom);		
	},

	setTimingExtraBeats: function(extrabeats) {
		this.timing.extrabeats = parseInt(extrabeats);
	},

	setTimingBars: function(bars) {
		this.timing.bars = parseInt(bars);
	},
	
	seekToAndRenderAll: function(filename) {
		var progress = this.getLeftLocator();
		var my = this;
		if(this.isPlaying()) this.stop();
		this.resetSlices();
		this.segmentIndex = 0;
		this.filemaker.init(filename);
		this.seekToAndPlaySingle(progress + 0.0000000001, false, true, this.segmentIndex);
		// had to introduce this offset again to simulate a click *in* the slice and not on a marker, lol
		// see getSliceBoundaries in loop mode!
		this.on('render', function() {		
			if(my.activeSliceMarkers[1] == my.getRightLocator())  {  
				my.timing.pitchcomp = my.pitch;
				my.filemaker.pushzip(my.getSlices(), my.noteNumber, my.midiScale, my.timing); 	
				my.un('render');
				my.fireEvent('finished-render');
			}
			else {
				my.segmentIndex = my.segmentIndex  + 1;
				my.seekToAndPlaySingle(my.activeSliceMarkers[1] + 0.0000000001, false, true, my.segmentIndex);
			}
		});
	},


    stop: function () {
		this.un('pause');
        this.pause();
        this.seekTo(this.activeSliceMarkers[1]);
        //this.drawer.progress(0);
    },

	
	setBrowser: function(s) {
		/* either 'chrome-opera' or 'other'
		This is for a very little thing affecting sample-precise (relatively!) playback
		*/
		this.backend.setBrowser(s);	

	},
	

	
    /**
     * Set the playback volume.
     *
     * @param {Number} newVolume A value between 0 and 1, 0 being no
     * volume and 1 being full volume.
	 * (Well you can also crank the gain past 1 if you like - gdg)
     */
    setVolume: function (newVolume) {
        this.backend.setVolume(newVolume);
    },

	
    setEnvAttack: function (attack) {
       this.backend.setEnvAttack(attack/1000);
    },	

    setEnvHold: function (hold) {
       this.backend.setEnvHold(hold/1000);
    },	
	
    setEnvDecay: function (decay) {
        this.backend.setEnvDecay(decay/1000); // from ms to s
    },

	
    setCompThreshold: function (threshold) {
       this.backend.setCompThreshold(threshold);
    },	

    setCompRatio: function (ratio) {
        this.backend.setCompRatio(ratio);
    },	

    setCompAttack: function (attack) {
       this.backend.setCompAttack(attack);   // in s 
    },	

    setCompRelease: function (release) {
        this.backend.setCompRelease(release);
    },	
	
	setLoFreq: function (freq) {
       this.backend.setLoFreq(freq);
    },	

	setHiFreq: function (freq) {
       this.backend.setHiFreq(freq);
    },	
	
	setMidFreq: function (freq) {
       this.backend.setMidFreq(freq);
    },		

	setLoGain: function (gain) {
       this.backend.setLoGain(gain);
    },	

	setHiGain: function (gain) {
       this.backend.setHiGain(gain);
    },	
	
	setMidGain: function (gain) {
       this.backend.setMidGain(gain);
    },
	
	setMidQ: function (q) {
       this.backend.setMidQ(q);
    },		
    /**
     * Set the playback rate.
     *
     * @param {Number} rate A positive number. E.g. 0.5 means half the
     * normal speed, 2 means double speed and so on.
     */
    setPlaybackRate: function (rate) {
        this.backend.setPlaybackRate(rate);
    },

    /**
     * Toggle the volume on and off. It not currenly muted it will
     * save the current volume value and turn the volume off.
     * If currently muted then it will restore the volume to the saved
     * value, and then rest the saved value.
     */
    toggleMute: function () {
        if (this.isMuted) {
            // If currently muted then restore to the saved volume
            // and update the mute properties
            this.backend.setVolume(this.savedVolume);
            this.isMuted = false;
        } else {
            // If currently not muted then save current volume,
            // turn off the volume and update the mute properties
            this.savedVolume = this.backend.getVolume();
            this.backend.setVolume(0);
            this.isMuted = true;
        }
    },

    toggleScroll: function () {
        this.params.scrollParent = !this.params.scrollParent;
        this.drawBuffer();
    },

    toggleInteraction: function () {
        this.params.interact = !this.params.interact;
    },

    drawBuffer: function () {
        var nominalWidth = Math.round(
            this.getDuration() * this.params.minPxPerSec * this.params.pixelRatio
        );
        var parentWidth = this.drawer.getWidth();
        var width = nominalWidth;

        // Fill container
        if (this.params.fillParent && (!this.params.scrollParent || nominalWidth < parentWidth)) {
            width = parentWidth;
        }
        var peaks = this.backend.getPeaks(width);
        this.drawer.drawPeaks(peaks, width);
        this.fireEvent('redraw', peaks, width);
    },

    zoom: function (pxPerSec) {
        this.params.minPxPerSec = pxPerSec;
		this.clearRegionPositions();
        this.params.scrollParent = true;
        this.drawBuffer();
		this.drawer.progress(this.backend.getPlayedPercents());
        this.fireEvent('zoom', pxPerSec);
    },

    /**
     * Internal method.
     */
    loadArrayBuffer: function (arraybuffer) {
        this.decodeArrayBuffer(arraybuffer, function (data) {
            this.loadDecodedBuffer(data);
        }.bind(this));
    },

    /**
     * Directly load an externally decoded AudioBuffer.
     */
    loadDecodedBuffer: function (buffer) {
        this.backend.load(buffer);
		this.initTransientPool(buffer);
        this.drawBuffer();
        this.fireEvent('ready');
    },

    /**
     * Loads audio data from a Blob or File object.
     *
     * @param {Blob|File} blob Audio data.
     */
    loadBlob: function (blob) {
        var my = this;
        // Create file reader
        var reader = new FileReader();
        reader.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        reader.addEventListener('load', function (e) {
            my.loadArrayBuffer(e.target.result);
        });
        reader.addEventListener('error', function () {
            my.fireEvent('error', 'Error reading file');
        });
        reader.readAsArrayBuffer(blob);
        this.empty();
    },

    /**
     * Loads audio and rerenders the waveform.
     */
    load: function (url, peaks) {
        switch (this.params.backend) {
            case 'WebAudio': return this.loadBuffer(url);
            case 'MediaElement': return this.loadMediaElement(url, peaks);
        }
    },

    /**
     * Loads audio using Web Audio buffer backend.
     */
    loadBuffer: function (url) {
        this.empty();
        // load via XHR and render all at once
        return this.getArrayBuffer(url, this.loadArrayBuffer.bind(this));
    },

    loadMediaElement: function (url, peaks) {
        this.empty();
        this.backend.load(url, this.mediaContainer, peaks);

        this.tmpEvents.push(
            this.backend.once('canplay', (function () {
                this.drawBuffer();
                this.fireEvent('ready');
            }).bind(this)),

            this.backend.once('error', (function (err) {
                this.fireEvent('error', err);
            }).bind(this))
        );


        // If no pre-decoded peaks provided, attempt to download the
        // audio file and decode it with Web Audio.
        if (!peaks && this.backend.supportsWebAudio()) {
            this.getArrayBuffer(url, (function (arraybuffer) {
                this.decodeArrayBuffer(arraybuffer, (function (buffer) {
                    this.backend.buffer = buffer;
                    this.drawBuffer();
                }).bind(this));
            }).bind(this));
        }
    },

    decodeArrayBuffer: function (arraybuffer, callback) {
        this.backend.decodeArrayBuffer(
            arraybuffer,
            this.fireEvent.bind(this, 'decoded'),
            this.fireEvent.bind(this, 'error', 'Error decoding audiobuffer')
        );
        this.tmpEvents.push(
            this.once('decoded', callback)
        );
    },

    getArrayBuffer: function (url, callback) {
        var my = this;
        var ajax = WaveSurfer.util.ajax({
            url: url,
            responseType: 'arraybuffer'
        });
        this.tmpEvents.push(
            ajax.on('progress', function (e) {
                my.onProgress(e);
            }),
            ajax.on('success', callback),
            ajax.on('error', function (e) {
                my.fireEvent('error', 'XHR error: ' + e.target.statusText);
            })
        );
        return ajax;
    },

    onProgress: function (e) {
        if (e.lengthComputable) {
            var percentComplete = e.loaded / e.total;
        } else {
            // Approximate progress with an asymptotic
            // function, and assume downloads in the 1-3 MB range.
            percentComplete = e.loaded / (e.loaded + 1000000);
        }
        this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
    },

    /**
     * Exports PCM data into a JSON array and opens in a new window.
     */
    exportPCM: function (length, accuracy, noWindow) {
        length = length || 1024;
        accuracy = accuracy || 10000;
        noWindow = noWindow || false;
        var peaks = this.backend.getPeaks(length, accuracy);
        var arr = [].map.call(peaks, function (val) {
            return Math.round(val * accuracy) / accuracy;
        });
        var json = JSON.stringify(arr);
        if (!noWindow) {
            window.open('data:application/json;charset=utf-8,' +
                encodeURIComponent(json));
        }
        return json;
    },

    clearTmpEvents: function () {
        this.tmpEvents.forEach(function (e) { e.un(); });
    },

    /**
     * Display empty waveform.
     */
    empty: function () {
        if (!this.backend.isPaused()) {
            this.stop();
            this.backend.disconnectSource();
        }
        this.clearTmpEvents();
        this.drawer.progress(0);
        this.drawer.setWidth(0);
        this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
    },

    /**
     * Remove events, elements and disconnect WebAudio nodes.
     */
    destroy: function () {
        this.fireEvent('destroy');
        this.clearTmpEvents();
        this.unAll();
        this.backend.destroy();
        this.drawer.destroy();
    }
};

WaveSurfer.create = function (params) {
    var wavesurfer = Object.create(WaveSurfer);
    wavesurfer.init(params);
    return wavesurfer;
};
