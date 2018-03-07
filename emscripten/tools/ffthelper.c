#include "ffthelper.h"

void rect_polar(float *real, float *imag, int n) {
	float rcpn = 1.f/(float)n;
	float magn, phase, angle, r, abs_y;
	 for(int i = 0; i <= n/2; i++) {
	  // this doesn't do the conjugates in the second half; if you want them, they're easy to generate downstream
		magn = sqrt(real[i]*real[i] + imag[i]*imag[i]);
		// inlined the 'cheat atan2' here
		// todo: trash the phases for really small values
		abs_y = fabs(imag[i])+0.0000000001; 
		if(real[i]>=0){
			r = (real[i] - abs_y) / (real[i] + abs_y);
			phase = 0.78539816 + (0.1963 * r * r - 0.9817) * r;
		}
		else{
			r = (real[i] + abs_y) / (abs_y - real[i]);
			phase = 2.35619449 + (0.1963 * r * r - 0.9817) * r; 
		}
	  if (imag[i] < 0) phase = -phase;     
	  real[i] = magn * rcpn;
	  imag[i] = phase;
	}
}

void rect_polar_zerophase(float *real, float *imag, int n) {
  // call this when you need a spectrum with no phase information (if you won't be resynthesizing it back from the data)
	float rcpn = 1.f/(float)n;
	float magn;
	for(int i = 0; i <= n/2; i++) {
		magn = sqrt(real[i]*real[i] + imag[i]*imag[i]);
		real[i] = magn * rcpn;
		imag[i] = 0.f;
	}
}

void polar_rect(float *real, float *imag, int n) {
	// if you have a zero-phase spectrum like e.g. a constructed convolution kernel, there is no need to call this 
	// this doesn't do the conjugates in the second half; if you want them, they're easy to generate downstream
	float re, im;
	for(int i = 0; i <= n/2; i++) {
	    //re = real[i]*fast_cos(imag[i]); // tried 'fast' cos/sin approximations; they sounded like shit
	    //im = real[i]*fast_sin(imag[i]);
		re = real[i]*cos(imag[i]);
		im = real[i]*sin(imag[i]);
		real[i] = re;
		imag[i] = im;
	 }	
}




