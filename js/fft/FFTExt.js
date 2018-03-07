/*
  Copyright (c) 2015-2016 Chris Cannam
   Copyright (c) 2015-2016 Queen Mary, University of London

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use, copy,
    modify, merge, publish, distribute, sublicense, and/or sell copies
    of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
    CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

    Except as contained in this notice, the names of the Centre for
    Digital Music; Queen Mary, University of London; and Chris Cannam
    shall not be used in advertising or otherwise to promote the sale,
    use or other dealings in this Software without prior written
    authorization.
*/


"use strict";

var FFTExtModule = FFTExtModule({});

var kiss_fftr_alloc = FFTExtModule.cwrap(
    'kiss_fftr_alloc', 'number', ['number', 'number', 'number', 'number' ]
);

var kiss_fftr = FFTExtModule.cwrap(
    'kiss_fftr', 'void', ['number', 'number', 'number' ]
);

var kiss_fftri = FFTExtModule.cwrap(
    'kiss_fftri', 'void', ['number', 'number', 'number' ]
);

var kiss_fftr_free = FFTExtModule.cwrap(
    'kiss_fftr_free', 'void', ['number']
);

var kiss_fft_alloc = FFTExtModule.cwrap(
    'kiss_fft_alloc', 'number', ['number', 'number', 'number', 'number' ]
);

var kiss_fft = FFTExtModule.cwrap(
    'kiss_fft', 'void', ['number', 'number', 'number' ]
);

var kiss_fft_free = FFTExtModule.cwrap(
    'kiss_fft_free', 'void', ['number']
);

var rect_polar = FFTExtModule.cwrap(
    'rect_polar', 'void', ['number', 'number', 'number']
);

var rect_polar_zerophase = FFTExtModule.cwrap(
    'rect_polar_zerophase', 'void', ['number', 'number', 'number']
);

var polar_rect = FFTExtModule.cwrap(
    'polar_rect', 'void', ['number', 'number', 'number']
);


function FFTExt(size) {
    this.size = size;
    this.fcfg = kiss_fftr_alloc(size, false);
    this.icfg = kiss_fftr_alloc(size, true);
    
    this.rptr = FFTExtModule._malloc(size*4 + (size+2)*4);
    this.cptr = this.rptr + size*4;
    
    this.ri = new Float32Array(FFTExtModule.HEAPU8.buffer, this.rptr, size);
    this.ci = new Float32Array(FFTExtModule.HEAPU8.buffer, this.cptr, size+2);
    
    this.forward = function(real) {
		this.ri.set(real);
		kiss_fftr(this.fcfg, this.rptr, this.cptr);
		return new Float32Array(FFTExtModule.HEAPU8.buffer,
				this.cptr, this.size + 2);
    }
    
    this.inverse = function(cpx) {
		this.ci.set(cpx);
		kiss_fftri(this.icfg, this.cptr, this.rptr);
		return new Float32Array(FFTExtModule.HEAPU8.buffer,
				this.rptr, this.size);
    }
    
	this.rect_polar = function(re, im, size) {
		this.ri.set(re);
		this.ci.set(im);
		rect_polar(this.rptr, this.cptr, size);
		re.set(this.ri); 
		im.set(this.ci.slice(0,size));
	}
	
	this.rect_polar_zerophase = function(re, im, size) {
		this.ri.set(re);
		this.ci.set(im);
		rect_polar_zerophase(this.rptr, this.cptr, size);
		re.set(this.ri); 
		im.set(this.ci.slice(0,size));
	}
	
	this.polar_rect = function(re, im, size) {
		this.ri.set(re);
		this.ci.set(im);
		polar_rect(this.rptr, this.cptr, size);
		re.set(this.ri); 
		im.set(this.ci.slice(0,size));
	}	

    this.dispose = function() {
		FFTExtModule._free(this.rptr);
		kiss_fftr_free(this.fcfg);
		kiss_fftr_free(this.icfg);
    }
}
