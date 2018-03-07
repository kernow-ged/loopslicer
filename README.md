# loopslicer
A web app for slicing and dicing audio files as demonstrated at http://kernow.me/loopslicer  
This is a purely front-end app that requires no server or special installation.

Attempts to detect the beats of, say, a drum loop, decompose the file into separate 'hits' and export the individual hits as WAV files, together with a MIDI file describing the timing of the original loop and an SFZ file for compatible software samplers. You can optionally apply various WebAudio DSP processes to the edited audio file. 

Complete operating instructions are in the index.html file.
The GUI is based on a highly modified version of [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js).
This app was conceived of and made in early 2016; somehow I hadn't got round to posting it up here till now, 2018.

**Building**: 
It's all ready to go as-is. The emscripten folder has a makefile for producing an asm.js file at js/fft/FFTExtAsm.js; you'll need the LLVM and Emscripten compilers to make any updated versions of this file (run 'emmake make'). 

Somehow various JS concatenators/minifiers did not work for me so I made one big master JS file by hand! This is the version referenced on my site. 

**Thanks**: to, inter alia, Mario 
(http://www.badlogicgames.com/wordpress/?p=122) et seq
for showing a nice way to get started with note-onset detection 

Chris Cannam
(https://thebreakfastpost.com/2015/10/18/ffts-in-javascript/)
for demonstrating some FFT implementations in javascript, and how to cross-compile some native FFT libraries of note to asm.js
The FFT is used at the file-loading phase in an attempt to detect note onsets with which to demarcate the audio

Matt Diamond
(https://webaudiodemos.appspot.com/AudioRecorder/)
for reminding me how a WAV file header was constructed 

Ollie: for playing the drum loop that is our application's default soundfile, ol2.wav. 

and katspaugh the originator of the aforementioned wavesurfer.js, for providing the best HTML5 audio visualisation tools.
