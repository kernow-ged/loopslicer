function fftwola(fftsize, overlap, samplerate) {	
	// fftsize and overlap should be, of course, powers of 2: overlap in the range 2--8 
	// fftsize from 512 to 4096 or so
	this.fftsize = fftsize;
	this.fftsize2 = fftsize * 2;
	this.overlap = overlap; 	
	this.samplerate = samplerate || 44100.0;
	this.frequnit = this.samplerate / this.fftsize;
	this.fft = new FFTExt(fftsize);	
	
	this.outputAccumulator = new Float32Array(this.fftsize2);
	this.flux =  new Float32Array(this.overlap);

	this.oldmags = new Float32Array(this.fftsize/2 +1);
	for(var i=0; i<this.fftsize/2 +1; ++i) {
		this.oldmags[i] = 0.0;
	}
	
	this.inputAccumulator = new Float32Array(this.fftsize2); 
	this.reals = new Float32Array(this.fftsize);
	this.imags = new Float32Array(this.fftsize);
	this.peaks = [];  
	this.peakindices = [];
	this.hannWindow = new Float32Array(this.fftsize);
	
	for(var i=0; i<this.fftsize; ++i) {
		this.hannWindow[i] = -0.5 * Math.cos(6.2831853 * (i/this.fftsize)) + 0.5;
	}
	
	this.audibleThreshold_dB = new Float32Array(this.fftsize/2 +1);	
	this.audibleThreshold_v = new Float32Array(this.fftsize/2 +1);	
	
	this.audibleThreshold_dB[0] = 0;
	this.audibleThreshold_v[0] = 1;
	
	for(var i=1; i<=this.fftsize/2; ++i) {
		var f = (this.frequnit * i) / 1000;
		this.audibleThreshold_dB[i] = ((3.64 * Math.pow(f, -0.8)) - (6.5 * Math.exp(-0.6 * (f - 3.3) * (f - 3.3))) + (0.001 * Math.pow(f, 4))) - 96.0;
		this.audibleThreshold_v[i] = Math.pow(10, this.audibleThreshold_dB[i] * 0.05);		
	}		

	this.barks = new Float32Array(this.fftsize/2 +1);	
	this.barks[0] = 0;
	for(var i=1; i<=this.fftsize/2; ++i) {
		var f = ((this.frequnit * i) / 1000) * 0.76;
		var f2 = (this.frequnit * i) / 7500;
		this.barks[i] = (13.0 * Math.atan(f)) + (3.5 * Math.atan(f2 * f2));	
	}
	
	this.reset = function() {
		for(var i=0; i < this.fftsize; ++i) {
			this.reals[i] = this.imags[i] = this.inputAccumulator[i] = this.outputAccumulator[i] = 0.0;
		}
		for(var i=this.fftsize; i < this.fftsize2; ++i) {
			this.outputAccumulator[i] = this.inputAccumulator[i] = 0.0;
		}	
	}
	
	this.reset(); // go ahead + initialise everything 
	
	this.window = function() {
		for(var i=0; i<this.fftsize; ++i) {
			this.reals[i] *= this.hannWindow[i];
		}
	}
	
	this.dispose = function() {
		this.fft.dispose();
	}

	this.findPeaks = function() {
		// quick & dirty peak-picking; may miss some, idk, but that doesn't matter too much for our purposes
		this.peaks = [];  // reset 
		this.peakindices = [];
		var diff = 0.0;
		var last_diff = 0.0;
		var windowlength = this.fftsize >= 256 ? this.fftsize/256 : 1; 
		// the smaller this is, (or the larger the denominator that is 256 here, iow) the more peaks will be logged 
		var windowinc = windowlength;
		var tracker = windowlength;
		var reset = 1;
		for(var i=1; i<=this.fftsize/2; ++i) {   
			diff = this.reals[i] - this.reals[i-1];
			if(diff <0.0 && last_diff>=0.0) { // that >= denotes rhs of peak if peak is flat
				if(reset == 1) {
					this.peaks.push(this.reals[i-1]);  
					this.peakindices.push(i-1);
					reset = 0;
					continue;  
				}
				var t = this.peaks.pop();
				if(this.reals[i-1] > t) {
					// if bigger peak found, fuck last peak off (push new one)
					this.peaks.push(this.reals[i-1]);
					this.peakindices.pop();
					this.peakindices.push(i-1);					
					tracker = windowlength;  // reset the tracker 
				}
				else {
					// push old one back, ignore the new (smaller) one
					this.peaks.push(t);
				}
			}
			last_diff = diff;
			tracker--;  
			if(tracker == 0) { 
				windowlength += windowinc;
				// dynamically change windowlength w/increasing frequency (this is experimental tweakery)
				// these 8 and +8 settings seem p. good though; capturing bass, bass/mid, lower mid, upper mid...
				// that's 8 and +8 at FFT2048, anyway
				// you'll get about 16 peaks out of it, even with noise, & also do you really need to go all the way to 22kHz?
				tracker = windowlength;
				// reset so first push is a 'free push' without any comparator
				reset = 1;
			}			
		}

	}
	
	this.process = function(input, output) {
		for(var i=this.fftsize; i<this.fftsize2; ++i) {
			this.inputAccumulator[i] = input[i-this.fftsize];
		}
		var step = this.fftsize/this.overlap;
		var norm = 2.6/this.overlap;
		// the factor of 2.6 is to compensate for the hann-windowing
		for(var i=0; i<this.overlap; i++) {
			this.flux[i] = 0.0;
		}
		for(var stage=0; stage<this.overlap; stage++) {
			var hop1 = step * (stage+1);
			var hop2 = step * stage;
			for(var i=0; i<this.fftsize; ++i) {
				this.reals[i] = this.inputAccumulator[i + hop1];
			}

			this.window();   
			var fftbuf = this.fft.forward(this.reals);
			for (var i=0; i<fftbuf.length; i+=2) {
				this.reals[i >> 1] = fftbuf[i];
				this.imags[i >> 1] = fftbuf[i+1];
			}

			this.processSpectrum(stage); 		
		}	

		for(var i=0; i<this.overlap; ++i) {
			output[i] = this.flux[i];
		}
		
		// rotate accumulators by 1/2
		for(var i=0; i<this.fftsize; ++i) {
			this.inputAccumulator[i] = this.inputAccumulator[i+this.fftsize];
		}

	}

	
	this.processSpectrum = function(stage) {
		this.fft.rect_polar(this.reals, this.imags, this.fftsize); 
		var acc = 0;
		for(var i=0; i<this.fftsize/2 +1; i++) {
			var d = this.reals[i] - this.oldmags[i];
			if(d > 0) acc += d;
			this.oldmags[i] = this.reals[i];
		}
		this.flux[stage] = acc;
		//this.ffthelper.polar_rect(this.reals, this.imags, this.fftsize);
	}		
}	
