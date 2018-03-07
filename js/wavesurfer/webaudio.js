'use strict';

WaveSurfer.WebAudio = {
    scriptBufferSize: 256,
    PLAYING_STATE: 0,
    PAUSED_STATE: 1,
    FINISHED_STATE: 2,
	
    DECAY_MAX: 10,
	
    browser: 'other',

    supportsWebAudio: function () {
        return !!(window.AudioContext || window.webkitAudioContext);
    },

    getAudioContext: function () {
        if (!WaveSurfer.WebAudio.audioContext) {
            WaveSurfer.WebAudio.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            );
        }
        return WaveSurfer.WebAudio.audioContext;
    },

    getOfflineAudioContext: function (sampleRate) {
        if (!WaveSurfer.WebAudio.offlineAudioContext) {
            WaveSurfer.WebAudio.offlineAudioContext = new (
                window.OfflineAudioContext || window.webkitOfflineAudioContext
            )(1, 2, sampleRate);
        }
        return WaveSurfer.WebAudio.offlineAudioContext;
    },

	
	setBrowser: function(s) {
		this.browser = s;		
	}, 
	
    init: function (params) {
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();

        this.lastPlay = this.ac.currentTime;
        this.startPosition = 0;
        this.scheduledPause = null;
		
		this.attack = 0;
		this.hold = 0;
		this.decay = this.DECAY_MAX;
		
        this.states = [
            Object.create(WaveSurfer.WebAudio.state.playing),
            Object.create(WaveSurfer.WebAudio.state.paused),
            Object.create(WaveSurfer.WebAudio.state.finished)
        ];

        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();

		this.createPreGain();
		this.createEnvGain();
		this.createCompressorNode();
		this.createLoEQ();
		this.createMidEQ();
		this.createHiEQ();		
		
		this.setFilters([this.preGainNode, this.envGainNode, this.compressorNode, this.lo, this.mid, this.hi]);
        this.setState(this.PAUSED_STATE);
        this.setPlaybackRate(this.params.audioRate);
    },

    disconnectFilters: function () {
        if (this.filters) {
            this.filters.forEach(function (filter) {
                filter && filter.disconnect();
            });
            this.filters = null;
            // Reconnect direct path
            this.analyser.connect(this.gainNode);
        }
    },

    setState: function (state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    },

    // Unpacked filters
    setFilter: function () {
        this.setFilters([].slice.call(arguments));
    },

    /**
     * @param {Array} filters Packed ilters array
     */
    setFilters: function (filters) {
        // Remove existing filters
        this.disconnectFilters();

        // Insert filters if filter array not empty
        if (filters && filters.length) {
            this.filters = filters;

            // Disconnect direct path before inserting filters
            this.analyser.disconnect();

            // Connect each filter in turn
            filters.reduce(function (prev, curr) {
                prev.connect(curr);
                return curr;
            }, this.analyser).connect(this.gainNode);
        }

    },

    createScriptNode: function () {
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(this.scriptBufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(this.scriptBufferSize);
        }

        this.scriptNode.connect(this.ac.destination);
    },

    addOnAudioProcess: function () {
        var my = this;
		if(this.browser == 'other') {
			this.scriptNode.onaudioprocess = function () {
			var time = my.getCurrentTime();
			if (time >= my.scheduledPause) { 
				my.setState(my.PAUSED_STATE);
				my.source.stop(0);
				my.fireEvent('pause');
			}
				else if (time >= my.scheduledLoopPoint) {
					my.setPreGain(0);
					my.un('audioprocess'); // we don't want cursor to move past our loop point
				} else if (my.state === my.states[my.PLAYING_STATE]) {
					my.fireEvent('audioprocess', time);
				}
			};
		}
		else {  
			// chrome/opera playback
			this.scriptNode.onaudioprocess = function () {
				var time = my.getCurrentTime();
				if (time >= my.scheduledLoopPoint) {
				    my.un('audioprocess'); // we don't want cursor to move past our loop point
				} else if (my.state === my.states[my.PLAYING_STATE]) {
					my.fireEvent('audioprocess', time);
				}
			};		
		}
    },
	
    removeOnAudioProcess: function () {
        this.scriptNode.onaudioprocess = null;
    },

    createAnalyserNode: function () {
        this.analyser = this.ac.createAnalyser();
        this.analyser.connect(this.gainNode);
    },

    /**
     * Create the gain node needed to control the playback volume.
     */
    createVolumeNode: function () {
        // Create gain node using the AudioContext
        if (this.ac.createGain) {
            this.gainNode = this.ac.createGain();
        } else {
            this.gainNode = this.ac.createGainNode();
        }
        // Add the gain node to the graph
        this.gainNode.connect(this.ac.destination);
    },

	createPreGain: function () {
        if (this.ac.createGain) {
            this.preGainNode = this.ac.createGain();
        } else {
            this.preGainNode = this.ac.createGainNode();
        }		
	},
	
	createEnvGain: function () {
        if (this.ac.createGain) {
            this.envGainNode = this.ac.createGain();
        } else {
            this.envGainNode = this.ac.createGainNode();
        }		
	},

	createCompressorNode: function () {
        if (this.ac.createDynamicsCompressor) {
            this.compressorNode = this.ac.createDynamicsCompressor();
        } else {
            this.compressorNode = this.ac.createDynamicsCompressorNode();
        }	
		this.compressorNode.threshold.value = 0;
		this.compressorNode.ratio.value = 1;
		this.compressorNode.attack.value = 0.07;
		this.compressorNode.release.value = 0.1;
	},


	createLoEQ: function () {
        if (this.ac.createBiquadFilter) {
            this.lo = this.ac.createBiquadFilter();
        } else {
            this.lo = this.ac.createBiquadFilterNode();
        }	

		this.lo.type = "lowshelf";
		this.lo.frequency.value = 250;
		this.lo.gain.value = 0;
	},

	createHiEQ: function () {
        if (this.ac.createBiquadFilter) {
            this.hi = this.ac.createBiquadFilter();
        } else {
            this.hi = this.ac.createBiquadFilterNode();
        }	

		this.hi.type = "highshelf";
		this.hi.frequency.value = 4000;
		this.hi.gain.value = 0;
	},	

	createMidEQ: function () {
        if (this.ac.createBiquadFilter) {
            this.mid = this.ac.createBiquadFilter();
        } else {
            this.mid = this.ac.createBiquadFilterNode();
        }	

		this.mid.type = "peaking";
		this.mid.frequency.value = 1000;
		this.mid.gain.value = 0;
		this.mid.Q.value = 1;
	},	
	
    /**
     * Set the gain to a new value.
     *
     * @param {Number} newGain The new gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    setVolume: function (newGain) {
        this.gainNode.gain.value = newGain;
    },

	
   setPreGain: function (newGain) {
        this.preGainNode.gain.value = newGain;
    },	
	

   setEnvAttack: function (attack) {
        this.attack = attack;	
    },	

   setEnvHold: function (hold) {
        this.hold = hold;	
    },	
	
   setEnvDecay: function (decay) {
        this.decay = decay;	
    },		
	
    setCompThreshold: function (threshold) {
       this.compressorNode.threshold.value = threshold;
    },	

    setCompRatio: function (ratio) {
        this.compressorNode.ratio.value = ratio;
    },	

    setCompAttack: function (attack) {
       this.compressorNode.attack.value = attack;
    },	

    setCompRelease: function (release) {
       this.compressorNode.release.value = release;
    },	

	setLoFreq: function (freq) {
       this.lo.frequency.value = freq;
    },	

	setHiFreq: function (freq) {
       this.hi.frequency.value = freq;
    },	
	
	setMidFreq: function (freq) {
       this.mid.frequency.value = freq;
    },		

	setLoGain: function (gain) {
       this.lo.gain.value = gain;
    },	

	setHiGain: function (gain) {
       this.hi.gain.value = gain;
    },	
	
	setMidGain: function (gain) {
       this.mid.gain.value = gain;
    },
	
	setMidQ: function (q) {
       this.mid.Q.value = q;
    },	

	setBrowser: function(s){
		this.browser = s;
	},
	
    /**
     * Get the current gain.
     *
     * @returns {Number} The current gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    getVolume: function () {
        return this.gainNode.gain.value;
    },

    decodeArrayBuffer: function (arraybuffer, callback, errback) {
        if (!this.offlineAc) {
            this.offlineAc = this.getOfflineAudioContext(this.ac ? this.ac.sampleRate : 44100);
        }
        this.offlineAc.decodeAudioData(arraybuffer, (function (data) {
            callback(data);
        }).bind(this), errback);
    },

    /**
     * Compute the max and min value of the waveform when broken into
     * <length> subranges.
     * @param {Number} How many subranges to break the waveform into.
     * @returns {Array} Array of 2*<length> peaks or array of arrays
     * of peaks consisting of (max, min) values for each subrange.
     */
    getPeaks: function (length) {
        var sampleSize = this.buffer.length / length;
        var sampleStep = ~~(sampleSize / 10) || 1;
        var channels = this.buffer.numberOfChannels;
        var splitPeaks = [];
        var mergedPeaks = [];

        for (var c = 0; c < channels; c++) {
            var peaks = splitPeaks[c] = [];
            var chan = this.buffer.getChannelData(c);

            for (var i = 0; i < length; i++) {
                var start = ~~(i * sampleSize);
                var end = ~~(start + sampleSize);
                var min = chan[0];
                var max = chan[0];

                for (var j = start; j < end; j += sampleStep) {
                    var value = chan[j];

                    if (value > max) {
                        max = value;
                    }

                    if (value < min) {
                        min = value;
                    }
                }

                peaks[2 * i] = max;
                peaks[2 * i + 1] = min;

                if (c == 0 || max > mergedPeaks[2 * i]) {
                    mergedPeaks[2 * i] = max;
                }

                if (c == 0 || min < mergedPeaks[2 * i + 1]) {
                    mergedPeaks[2 * i + 1] = min;
                }
            }
        }

        return this.params.splitChannels ? splitPeaks : mergedPeaks;
    },

    getPlayedPercents: function () {
        return this.state.getPlayedPercents.call(this);
    },

    disconnectSource: function () {
        if (this.source) {
            this.source.disconnect();
        }
    },

    destroy: function () {
        if (!this.isPaused()) {
            this.pause();
        }
        this.unAll();
        this.buffer = null;
        this.disconnectFilters();
        this.disconnectSource();
        this.gainNode.disconnect();
        this.scriptNode.disconnect();
        this.analyser.disconnect();
    },

    load: function (buffer) {
        this.startPosition = 0;
        this.lastPlay = this.ac.currentTime;
        this.buffer = buffer;
        this.createSource();	
    },

    createSource: function () {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();

        //adjust for old browsers.
        this.source.start = this.source.start || this.source.noteGrainOn;
        this.source.stop = this.source.stop || this.source.noteOff;

        this.source.playbackRate.value = this.playbackRate;
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
    },
	
    isPaused: function () {
        return this.state !== this.states[this.PLAYING_STATE];
    },

    getDuration: function () {
        if (!this.buffer) {
            return 0;
        }
        return this.buffer.duration;
    },

    seekTo: function (start, end) {
        this.scheduledPause = null;

        if (start == null) {
            start = this.getCurrentTime();
            if (start >= this.getDuration()) {
                start = 0;
            }
        }
        if (end == null) {
            end = this.getDuration();
        }

        this.startPosition = start;
        this.lastPlay = this.ac.currentTime;

        if (this.state === this.states[this.FINISHED_STATE]) {
            this.setState(this.PAUSED_STATE);
        }

        return { start: start, end: end };
    },

    getPlayedTime: function () {
        return (this.ac.currentTime - this.lastPlay) * this.playbackRate;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end When to stop
     * relative to the beginning of a clip.
     */
    play: function (start, end) {
        // need to re-create source on each playback
        this.createSource();
		this.setPreGain(1);
        var adjustedTime = this.seekTo(start, end);

        start = adjustedTime.start;
        end = adjustedTime.end;

        this.scheduledPause = end;

        this.source.start(0, start, end - start);

        this.setState(this.PLAYING_STATE);

        this.fireEvent('play');
    },

	
	slices: [],
	
	resetSlices: function() {
		this.slices = [];	
	},
	
	
	getSlices: function() {
		return this.slices;
	},
	
	
	render: function(start, end, index) {
		var frames= Math.floor((end - start) * this.ac.sampleRate / this.playbackRate);  // 
		var offset = 264;
		/*
 		 compensation for latency in the compressor: 264 samples. It's attested to on net too: 
		 http://stackoverflow.com/questions/25807887/using-an-offline-context-in-the-web-audio-api-shift-the-signal-of-264-samples
		 observed in FF, Chrome and Opera
		*/
		var ctx = new OfflineAudioContext(this.buffer.numberOfChannels, frames + offset, this.ac.sampleRate); 
																			// ^^^ keep an eye on this offset
		this.source = ctx.createBufferSource();
		this.source.start = this.source.start || this.source.noteGrainOn;
		this.source.stop = this.source.stop || this.source.noteOff;
		this.source.buffer = this.buffer;
		this.source.playbackRate.value = this.playbackRate;	

		// mfw i realised i could not use the same signal chain from the original audio context
		// this was thrown together in a huff. but it works, lol
		var env = ctx.createGain();
		var compressor = ctx.createDynamicsCompressor();
		var gain = ctx.createGain();
		
		compressor.threshold.value = this.compressorNode.threshold.value;
		compressor.ratio.value = this.compressorNode.ratio.value;
		compressor.attack.value = this.compressorNode.attack.value;
		compressor.release.value = this.compressorNode.release.value;
		gain.gain.value = this.gainNode.gain.value;

		var l = ctx.createBiquadFilter();
		var m = ctx.createBiquadFilter();
		var h = ctx.createBiquadFilter();

		l.type = "lowshelf";
		m.type = "peaking";
		h.type = "highshelf";  

		l.frequency.value = this.lo.frequency.value;
		m.frequency.value = this.mid.frequency.value;
		h.frequency.value = this.hi.frequency.value;

		l.gain.value = this.lo.gain.value;
		m.gain.value = this.mid.gain.value;
		h.gain.value = this.hi.gain.value;
		
		m.Q.value = this.mid.Q.value;

		this.source.connect(env);
		
		env.connect(compressor);
		compressor.connect(gain);

		gain.connect(l);
		l.connect(m);
		m.connect(h);
		h.connect(ctx.destination);

 		env.gain.cancelScheduledValues(0);		
		if(this.attack > 0) {
			env.gain.setValueAtTime(0.0, ctx.currentTime);
			env.gain.linearRampToValueAtTime(1, ctx.currentTime + this.attack);
		}	
		if(this.decay < this.DECAY_MAX) {
			var t = new Float32Array(2);
			t[0] = 1.0;
			t[1] = 0.0;
			env.gain.setValueCurveAtTime(t, ctx.currentTime + this.attack + this.hold, this.decay);
		}	 
		this.source.start(0,start); 
		ctx.startRendering();
		var my = this;
		var index = index;
		ctx.oncomplete = function(e) {
			my.slices.push({slice: e.renderedBuffer, index: index});
			my.fireEvent("render", e.renderedBuffer);
		}
	},	 
	

	playExtended: function (start, loop, end, render, index) {   // end = extended end, loop = end of segment 
		if(render == true) {
			this.render(start, loop, index);
			return;
		}
		var my = this;
        this.createSource();
		this.setPreGain(1);
        var adjustedTime = this.seekTo(start, end);
		this.scheduledLoopPoint = loop;
        this.scheduledPause = end;  
		this.source.loop = true;
		this.source.loopStart = start;
		this.source.loopEnd = loop;
		this.preGainNode.gain.cancelScheduledValues(0);	
		this.envGainNode.gain.cancelScheduledValues(0);	
		this.envGainNode.gain.value = 1.0;
		if(this.attack > 0) {
			this.envGainNode.gain.setValueAtTime(0.0, this.ac.currentTime);
			this.envGainNode.gain.linearRampToValueAtTime(1, this.ac.currentTime + this.attack);
	    }
		if(this.decay < this.DECAY_MAX) {
			var t = new Float32Array(2);
			t[0] = 1.0;
			t[1] = 0.0;
			this.envGainNode.gain.setValueCurveAtTime(t, (this.ac.currentTime + parseFloat(this.attack) + parseFloat(this.hold)), parseFloat(this.decay));
		}

		this.source.start(0,start); 
		if(this.browser == "chrome-opera") {
			var length = (end - start)  / this.playbackRate;
			var loopPt = (loop - start) / this.playbackRate;
			this.preGainNode.gain.setValueAtTime(0.0, this.ac.currentTime + loopPt);	
			this.source.stop(this.ac.currentTime + length); 
			this.source.onended = function() {
				my.setState(my.PAUSED_STATE);
				my.fireEvent('pause');		
			}
		}
		/* 
		Chrome and Opera seem to give the most accurate timing with the above method; Firefox stops slightly short. But letting WaveSurfer's 
		monitoring scriptprocessor ascertain when to stop makes Firefox (& default browsers) err on playing slightly too much rather than too little. 
		If it stops short of playing the full segment, it may miss glitches at the end that later get rendered.
		*/ 
        this.setState(this.PLAYING_STATE);
        this.fireEvent('play');
    },	
	

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.scheduledPause = null;

        this.startPosition += this.getPlayedTime();
        this.source && this.source.stop(0);

        this.setState(this.PAUSED_STATE);

        this.fireEvent('pause');
    },

    /**
    *   Returns the current time in seconds relative to the audioclip's duration.
    */
    getCurrentTime: function () {
        return this.state.getCurrentTime.call(this);
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        value = value || 1;
        if (this.isPaused()) {
            this.playbackRate = value;
        } else {
            this.pause();
            this.playbackRate = value;
            this.play();
        }
    }
};

WaveSurfer.WebAudio.state = {};

WaveSurfer.WebAudio.state.playing = {
    init: function () {
       this.addOnAudioProcess();
    },
    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },
    getCurrentTime: function () {
        return this.startPosition + this.getPlayedTime();
    }
};

WaveSurfer.WebAudio.state.paused = {
    init: function () {
        this.removeOnAudioProcess();
    },
    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },
    getCurrentTime: function () {
        return this.startPosition;
    }
};

WaveSurfer.WebAudio.state.finished = {
    init: function () {
        this.removeOnAudioProcess();
        this.fireEvent('finish');
    },
    getPlayedPercents: function () {
        return 1;
    },
    getCurrentTime: function () {
        return this.getDuration();
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
