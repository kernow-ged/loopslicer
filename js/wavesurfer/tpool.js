WaveSurfer.TransientPool = {
	// NB: the word 'transient' itself is a reserved word in JS; do not use for a variable name :D
	
	fftlength: 1024,
	overlap: 4,
	delay: 768,
	MAX_TRANSIENTS: 128,
	
	filtered: function(ar) {
		var th = 1.3;
		var window = 5;
		var fd = new Float32Array(ar.length);
		for(var i=0; i<ar.length; i++) {
			var acc = 0.0;
			var lo = i - window > 0 ? i - window: 0;
			var hi = i + window < ar.length - 1 ? i + window: ar.length - 1;
			for(var x=lo; x<=hi; x++) {
				acc += ar[x];
			}
			acc /= (hi - lo);
			acc *= th;
			fd[i] = ar[i] > acc ? ar[i] : 0;
		}
		return fd;
	},
	
	twiddle: function(time, wave, fs) {
		var t = time;
		var spos = Math.floor(t * fs);
		var step = this.fftlength/this.overlap;
		step *= 3;  
		/* ^ how far back in history it will search to find the least-energy bit, in terms of the (overlapped) fft windows. just empirically 
		(mucking about) derived :)	it will backtrack at most about 20 ms, erring on side of being too early rather than being caught 'inside' an attack
		*/
		var lim = Math.floor(spos - step < 0 ? 0 : spos - step);
		var at = Math.abs(wave[spos]);
		var buf = [at,at,at,at,at,at,at,at,at,at];
		var total = at * 10;
		var lowest = total;
		var lowestIndex = spos;
		for(var x = spos-1; x > lim; x--) {
			total -= buf.pop();
			buf.unshift(Math.abs(wave[x]));
			total += Math.abs(wave[x]);
			if(total < lowest) {
				lowest = total;
				lowestIndex = x;
			}	
		}
		t = lowestIndex / fs;
		return t;
	},
	
	
	init: function(buffer) { 
		this.fftwola = new fftwola(this.fftlength, this.overlap, buffer.sampleRate);
		this.pool = [];
		var candidates = [];
		for(var x=0; x<this.MAX_TRANSIENTS; x++) {
			candidates.push({tscore:0, time:-1});
		}	

		var blocks = Math.ceil(buffer.length/this.fftlength);
		var inputBuffer = new Float32Array(this.fftlength);
		var analysisBuffer = new Float32Array(this.overlap * blocks);
		var tval = new Float32Array(this.overlap);
		var timePerBlock = this.fftlength/buffer.sampleRate;
		var timeOffset = this.delay/buffer.sampleRate;

		for(var x =0; x < analysisBuffer.length; x++) {
			analysisBuffer[x] = 0.0;
		}			

		var cd = buffer.getChannelData(0);
		
		var raw = new Float32Array(cd.length);
		
		for(var x =0; x < raw.length; x++) {
			raw[x] = cd[x];
		}
		
		if(buffer.numberOfChannels > 1) {
			var raw2 = buffer.getChannelData(1);
			for(var x =0; x < raw2.length; x++) {
				raw[x] = (raw[x] * 0.5) + (raw2[x] * 0.5);
			}
		}

		for(var x = 0; x<blocks; x++) {
			var start = this.fftlength * x;
			var end = start + this.fftlength;
			if(end > raw.length) {  // reached the end bit that is smaller than our buffer
				for(var y=0; y < inputBuffer.length; y++) {
					inputBuffer[y] = 0.0;
				}
				for(var y=start; y < raw.length; y++) {
					inputBuffer[y-start] = raw[y];
				}				
			}
			else {
				for(y=start; y<end; y++) {
					inputBuffer[y-start] = raw[y];
				}
			}	
			this.fftwola.process(inputBuffer, tval);
			
			for(var i=0; i<this.overlap; i++) {	
				analysisBuffer[(this.overlap * x) + i] = tval[i];
			}			
	
			this.fireEvent('analysing', Math.round((x/blocks) * 100));
		}

		analysisBuffer = this.filtered(analysisBuffer);
		
		for(var i=0; i<analysisBuffer.length; i++) {
			var time = i * (timePerBlock/this.overlap);
			for(var y=0; y<candidates.length; y++) {
				if(analysisBuffer[i] > candidates[y].tscore) {
					time = this.twiddle(time, raw, buffer.sampleRate);
					if(time<0) time = 0;
					candidates.splice(y, 0, {tscore: analysisBuffer[i], time: time}); 
					candidates.pop();
					break;
				}
			}	
		}
		
		var ms = 0.05;
		
		for(var y=0; y<candidates.length; y++) {	
			for(var x=y+1; x<candidates.length; x++) {
				var d = Math.abs(candidates[y].time - candidates[x].time);
				if(d < ms) {
					candidates[x].time = -1;
				}
			}
		}
		
		var largest = 0;

		for(var y=0; y<candidates.length; y++) {
			if(candidates[y].time >=0 && candidates[y].time < buffer.duration) {
				if(largest == 0) {
					largest = Math.ceil(100 * (1 - candidates[y].tscore));
				}
				var th = Math.ceil(100 * (1 - candidates[y].tscore) - largest) + 1;				
				this.pool.push({id: WaveSurfer.util.getId(), threshold: th, start: candidates[y].time});
			}
		}
		
		this.fftwola.dispose();
	},

	
	
	searchTransientPool: function(hi, lo) {
		var c = [];
		for(var t=0; t < this.pool.length; t++) {
			if(this.pool[t].threshold > lo && this.pool[t].threshold <= hi) {
				c.push(this.pool[t]);
			}
		}
		return c;
	},

	updatePoolData: function(id, start, threshold) {
		for(var t=0; t < this.pool.length; t++) {
			if(this.pool[t].id == id) {
				this.pool[t].threshold = threshold;
				this.pool[t].start = start;
				break;
			}
		}
	},
	
	removeFromPool: function(id) {
		for(var t=0; t < this.pool.length; t++) {
			if(this.pool[t].id == id) {
				this.pool.splice(t, 1);
				break;
			}
		}
	},	

};


WaveSurfer.util.extend(WaveSurfer.TransientPool, WaveSurfer.Observer);


WaveSurfer.initTransientPool = function (buffer) {
	var my = this;
    if (!this.transientPool) {
        this.transientPool = Object.create(WaveSurfer.TransientPool);
		this.transientPool.on('analysing', function (p) { my.fireEvent('analysing', p); });
    }
	this.transientPool.init(buffer);
};

WaveSurfer.searchTransientPool = function (hi, lo) {
	return(this.transientPool.searchTransientPool(hi,lo));
};

WaveSurfer.updatePoolData = function (id, start, threshold) {
	return(this.transientPool.updatePoolData(id, start, threshold));
};

WaveSurfer.removeFromPool = function (id) {
	this.transientPool.removeFromPool(id);
};

