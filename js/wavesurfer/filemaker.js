WaveSurfer.Filemaker = {

	zip: 0,
	filename: 'test',
	sampleRate: 44100,
	midiHeader: [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x03, 0xc0],	// 960 ticks/qtr note
	midiMtrk: [0x4d, 0x54, 0x72, 0x6b],
	midiFooter: [0x01, 0xff, 0x2f, 0x00],
	midiNotes: [],
	
	init: function(filename) {  
		this.zip = new JSZip();	
		this.filename = filename.split(".")[0];
		this.midiNotes = [];
	},


	/*!
	@license
	Float32-array to PCM WAV code lifted and adapted from https://webaudiodemos.appspot.com/AudioRecorder/js/recorderjs/recorderWorker.js
	
	License (MIT)

	Copyright Â© 2013 Matt Diamond

	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
	documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
	the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
	to permit persons to whom the Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all copies or substantial portions of 
	the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO 
	THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
	CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
	DEALINGS IN THE SOFTWARE.
	*/
	

	interleave: function(inputL, inputR) {
		var length = inputL.length + inputR.length;
		length -= 528;  // compensate for 264-sample latency incurred by compressor
		if(length < 2) {
			this.fireEvent("error", "segment too short to render: shorter than system latency!");
		}
		var result = new Float32Array(length);

		var index = 0,
		inputIndex = 264;  // compensate for 264-sample latency incurred by compressor

		while (index < length) {
			result[index++] = inputL[inputIndex];
			result[index++] = inputR[inputIndex];
			inputIndex++;
		}
		return result;
	},
	

	floatTo16BitPCM: function(output, offset, input) {
		for (var i = 0; i < input.length; i++, offset += 2) {
			var s = Math.max(-1, Math.min(1, input[i]));
			output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
		}
	},

	writeString: function(view, offset, string) {
		for (var i = 0; i < string.length; i++) {
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	},	
	
	encodeWAV: function(samples) {
		var buffer = new ArrayBuffer(44 + samples.length * 2);
		var view = new DataView(buffer);
		this.writeString(view, 0, 'RIFF');
		view.setUint32(4, 36 + samples.length * 2, true);  // this *was* 32; needed changing to 36
		this.writeString(view, 8, 'WAVE');
		this.writeString(view, 12, 'fmt '); // subchunk1 ID
		view.setUint32(16, 16, true); // 16 for pcm
		view.setUint16(20, 1, true);  // linear 
		view.setUint16(22, 2, true);  // stereo 2 channels
		view.setUint32(24, this.sampleRate, true); // fs
		view.setUint32(28, this.sampleRate * 4, true);  // fs * ch * (bitdepth/8)
		view.setUint16(32, 4, true);  // block align 
		view.setUint16(34, 16, true); // bits per samp
		this.writeString(view, 36, 'data');
		view.setUint32(40, samples.length * 2, true);
		this.floatTo16BitPCM(view, 44, samples);
		return view;
	},

	encodePCM: function(samples) {  
		// this was a diagnostic from when I couldn't get the WAV header right somehow
		var buffer = new ArrayBuffer(samples.length * 2);
		var view = new DataView(buffer);
		this.floatTo16BitPCM(view, 0, samples);
		return view;
	},

	makewav: function(buf) {
		var len = buf.length;
		this.sampleRate = buf.sampleRate;
		var interleaved;
		if(buf.numberOfChannels==2) {
			len *= 2;
			interleaved = this.interleave(buf.getChannelData(0), buf.getChannelData(1));
		}
		else {
			len *=2;
			interleaved = this.interleave(buf.getChannelData(0), buf.getChannelData(0));
		}
		var dataview = this.encodeWAV(interleaved);
		return dataview.buffer;
	},	
	
	zeroFill: function(number) { 
		// only need 3 digits
		var str = number + "";  
		if(number<10) str = "00" + str;
		else if(number<100) str = "0" + str;
		return str;
	},
	
	mlog2: function(d) {
		var lg = 0;
		while(d!=1) {
			lg++;
			d >>= 1;
		}
		return lg;
	},

	bytify: function(number, is7bit) {
		var modulus = is7bit ? 128: 256;
		var bytes = [];
		if(number == 0) return [0];
		var c = 0;
		while(number != 0) {
			var mbyte = number % modulus;
			number -= mbyte;
			if(c == 1 && is7bit) mbyte +=128;
			bytes.unshift(mbyte);
			c = 1;
			number /= modulus;
		}
		return bytes;
	},

	sizearray: function(number) {
		var b = this.bytify(number, false);
		if(b.length > 4) {  // shouldn't happen realistically, lol
			this.fireEvent("error", "too much midi data to fit length into 4 bytes");
			return b;
		}
		if(b.length == 4) return b;
		if(b.length == 3) return [0].concat(b);
		if(b.length == 2) return [0,0].concat(b);
		if(b.length == 1) return [0,0,0].concat(b);	
	},
	
	createMidiTimeSignature: function(num,denom) {
		return [0x00, 0xff, 0x58, 0x04, num, this.mlog2(denom), 24, 0x08];
	},

	createMidiTempo: function(bpm) {
		var tempo = Math.floor(60000000/bpm);  
		var temposetting = this.bytify(tempo, false);  
		var miditempo = [0x00, 0xff, 0x51]; 
		miditempo.push(temposetting.length); 
		for(i=0; i<temposetting.length; i++) {
			miditempo.push(temposetting[i]);
		}
		return miditempo;
	},

	writeNoteOnNoteOffPair: function(note, endtime) {
		this.midiNotes.push(0x00);
		this.midiNotes.push(0x90);
		this.midiNotes.push(note);
		this.midiNotes.push(0x7f);
		this.midiNotes = this.midiNotes.concat(this.bytify(endtime,true));
		this.midiNotes.push(0x80);
		this.midiNotes.push(note);
		this.midiNotes.push(0x00);	
	},	
	
	getNextNote: function(note, scale) {
		if(scale == "white-note") {
			switch(note%12) {
				case 0: // c,d,f,g,a
				case 2: 
				case 5:
				case 7:
				case 9:
					return note + 2;
					break;	
				case 4: // e,b
				case 11:
					return note + 1;
					break;				
			}
		}
		if(scale == "black-note") {
			switch(note%12) {
				case 1: // c#,f#,g#
				case 6: 
				case 8:
					return note + 2;
					break;	
				case 3: // d#,a#
				case 10:
					return note + 3;
					break;				
			}
		}
		if(scale == "chromatic") return note + 1;
	},


	addSfz: function(wavs, startnote, scale) {
		var s = "<group>\namp_veltrack=80\n";
		var note = startnote;
		var wavindex = 0;
		while(note <=127 && wavindex < wavs.length) {
			s += "<region>\nsample=slices/" + this.filename + "_" + this.zeroFill(wavs[wavindex].index) + ".wav" + "\n";
			// the path-separator was a backslash in the sfz files I inspected. But a forward slash works OK in Linuxsampler on Windows
			// but something to keep an eye on?
			s += "key=" + note.toString() + "\n";
			s += "pitch_keycenter=" + note.toString() + "\n";
			note = this.getNextNote(note, scale);
			wavindex = wavindex + 1;
		}
		this.zip.file(this.filename + ".sfz", s);
	},
	
	addMid: function(wavs, startnote, scale, timing) {
		var midi = [];
		midi = midi.concat(this.midiHeader);
		midi = midi.concat(this.midiMtrk);	
		var tempo = this.createMidiTempo(timing.bpm);
		var timesig = this.createMidiTimeSignature(timing.num, timing.denom);
		// make midi notes
		var note = startnote;
		var wavindex = 0;
		while(note <=127 && wavindex < wavs.length) {
			var len = wavs[wavindex].slice.length;
			len -= 264;  // compensate for compressor-induced latency
			len *= timing.pitchcomp;
			if(len < 2) {
			this.fireEvent("error", "audio file too short to replicate as midi event: shorter than system latency!");
			}
			this.sampleRate = wavs[wavindex].slice.sampleRate;
			var sliceTime = len/this.sampleRate;
			var ticks = Math.ceil(sliceTime/timing.timePerQtrNote * 960);
			this.writeNoteOnNoteOffPair(note, ticks);			
			note = this.getNextNote(note, scale);
			wavindex = wavindex + 1;	
		}
		var ln = tempo.length + timesig.length + this.midiNotes.length +  this.midiFooter.length;
		var size = this.sizearray(ln); 
		midi = midi.concat(size);
		midi = midi.concat(tempo);
		midi = midi.concat(timesig);
		midi = midi.concat(this.midiNotes);
		midi = midi.concat(this.midiFooter);
		var buffer = new ArrayBuffer(midi.length);
		var view = new DataView(buffer);
		for(var i=0; i<midi.length; i++) {
			view.setUint8(i,midi[i]);
		}
		this.zip.file(this.filename + "(" + (Math.round(timing.bpm * 100) / 100).toString() + "bpm).mid", view.buffer);	
	},
	
	pushzip: function(wavs, startnote, scale, timing) {
		this.addSfz(wavs, startnote, scale);
		this.addMid(wavs, startnote, scale, timing);
		for(var x=0; x<wavs.length; x++) {
			this.zip.file("slices/" + this.filename + "_" + this.zeroFill(wavs[x].index) + ".wav", this.makewav(wavs[x].slice));
		}	
		var content = this.zip.generate({type:"blob"});  
		saveAs(content, this.filename + ".zip");  
	}
	
};

WaveSurfer.util.extend(WaveSurfer.Filemaker, WaveSurfer.Observer);