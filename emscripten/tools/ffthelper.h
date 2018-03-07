#ifndef _ffthelper_
#define _ffthelper_
#include <math.h>
#include <stdlib.h>

void rect_polar(float *real, float *imag, int n);
void rect_polar_zerophase(float *real, float *imag, int n);
void polar_rect(float *real, float *imag, int n);

#endif