var filename = "untitled";

var avnotes = 127;

var playbutton = document.querySelector('[data-action="play"]');
playbutton.onclick = function() {
    if(wavesurfer.isPlaying()) wavesurfer.stop();
	else wavesurfer.seekToAndPlayAll(wavesurfer.getCurrentTime()/wavesurfer.getDuration());  	
};

var savebutton = document.querySelector('[data-action="save"]');
savebutton.onclick = function() {
    wavesurfer.seekToAndRenderAll(filename);
	savebutton.disabled=true;	
};

var osdbutton = document.querySelector('[data-action="opensavedialog"]');
osdbutton.onclick = function() {
    document.getElementById('slices').innerHTML = wavesurfer.getSlicesBetweenLocators();
	if(wavesurfer.getSlicesBetweenLocators() == 0) {
		savebutton.disabled=true;
		document.getElementById('zeroslicewarning').innerHTML = '<p><b>Please adjust the L and R indicators to select at least one slice of audio<br />(right locator is behind or on top of left locator)</b></p>';
	}
	else {
		savebutton.disabled=false;	
		document.getElementById('zeroslicewarning').innerHTML = '';
	}
	document.getElementById('avnotes').innerHTML = avnotes;	
	changeMidiParams();
	wavesurfer.setEstBpm();
	document.getElementById('estbpm').innerHTML = wavesurfer.getEstBpm();
};


document.addEventListener('DOMContentLoaded', function() {
	document.addEventListener('keydown', function(e) {
		if ( e.keyCode == 32 || e.keyCode == 0 ) {
			e.preventDefault();
			e.stopPropagation();
			document.getElementById('playbtn').click();
			var btns = document.getElementsByTagName("button");
			for (var i = 0; i < btns.length; i++) {
				btns[i].blur();
			}			
		}
		if ( e.keyCode == 46) {
			wavesurfer.regions.fireEvent('del');
		}
	});
});

var zoominbutton = document.querySelector('[data-action="zoomin"]');
zoominbutton.onclick = function() {
	zoomoutbutton.disabled = false;
	var lvl = wavesurfer.params.minPxPerSec;
	lvl *= 1.5;
	if(lvl < 300) lvl = 300;
	if(lvl >= 1700) {
	lvl = 1700;
	zoominbutton.disabled = true;
	}
	wavesurfer.zoom(lvl);
};

var zoomoutbutton = document.querySelector('[data-action="zoomout"]');	
zoomoutbutton.onclick = function() {
	zoominbutton.disabled = false;
	var lvl = wavesurfer.params.minPxPerSec;
	lvl /= 1.5;
	if(lvl <= 300) {
	lvl = 50;
	zoomoutbutton.disabled = true;
	}
	wavesurfer.zoom(lvl);
};	
	
var transientslider = document.querySelector('[data-action="tdetect"]');  
transientslider.oninput = function() {
	wavesurfer.setThreshold(Number(this.value));
	document.getElementById('thrshunits').innerHTML = Number(this.value);
};

var nudgeleft = document.querySelector('[data-action="nudgeleft"]');
nudgeleft.onclick = function() {
	wavesurfer.nudgeAll(-1);
};

var nudgeright = document.querySelector('[data-action="nudgeright"]');
nudgeright.onclick = function() {
	wavesurfer.nudgeAll(1);
};


var temposlider = document.querySelector('[data-action="tempo"]');
temposlider.oninput = function() {
    wavesurfer.setTempo(Number(this.value));
	document.getElementById('tempounits').innerHTML = Number(this.value) + 'x';
};	

var pitchslider = document.querySelector('[data-action="pitch"]');
pitchslider.oninput = function() {
    wavesurfer.setPitch(Number(Math.pow(1.059463094, this.value)));
	var p = '';
	if(this.value > 0) p = '+';
	document.getElementById('pitchunits').innerHTML = p + (Number(this.value));
};	

var attackslider = document.querySelector('[data-action="attack"]');
attackslider.oninput = function() {
    wavesurfer.setEnvAttack(Number(this.value));
	document.getElementById('attackunits').innerHTML = Number(this.value) + 'ms';	
};

var holdslider = document.querySelector('[data-action="hold"]');
holdslider.oninput = function() {
	var t = Math.floor(logValue(Number(this.value), 1, 5000, 1, 5000));
	wavesurfer.setEnvHold(t);
	if(t>=1000) {
		document.getElementById('holdunits').innerHTML = (t/1000).toFixed(2) + 's';
		}
     else document.getElementById('holdunits').innerHTML = t + 'ms';	
};	
	
var decayslider = document.querySelector('[data-action="decay"]');
decayslider.oninput = function() {
	var t = Math.floor(logValue(Number(this.value), 1, 10000, 1, 10000));
	wavesurfer.setEnvDecay(t);
	if(t === 10000) {
		document.getElementById('decayunits').innerHTML = '∞';	
		}
	else if(t>=1000) {
		document.getElementById('decayunits').innerHTML = (t/1000).toFixed(2) + 's';
		}
	else document.getElementById('decayunits').innerHTML = t + 'ms';	
};

var compthresholdslider = document.querySelector('[data-action="compthreshold"]');
compthresholdslider.oninput = function() {
    wavesurfer.setCompThreshold(Number(this.value));
	document.getElementById('compthresholdunits').innerHTML = Number(this.value) + 'dB';	
};	

var compratioslider = document.querySelector('[data-action="compratio"]');
compratioslider.oninput = function() {
    wavesurfer.setCompRatio(Number(this.value));
	document.getElementById('compratiounits').innerHTML = Number(this.value) + ':1';	
};	

var compattackslider = document.querySelector('[data-action="compattack"]');
compattackslider.oninput = function() {
    wavesurfer.setCompAttack(Number(this.value));
	document.getElementById('compattackunits').innerHTML = (Number(this.value) * 1000) + 'ms';	
};

var compreleaseslider = document.querySelector('[data-action="comprelease"]');
compreleaseslider.oninput = function() {
    wavesurfer.setCompRelease(Number(this.value));
	document.getElementById('compreleaseunits').innerHTML = (Number(this.value) * 1000) + 'ms';	
};

var gainslider = document.querySelector('[data-action="gain"]');
gainslider.oninput = function() {
    wavesurfer.setVolume(Math.pow(10.0, (Number(this.value)* 0.05)));
	var p = '';
	if(this.value > 0) p = '+';
	document.getElementById('gainunits').innerHTML = p + (Number(this.value)) + "dB";
};	

var lofreqslider = document.querySelector('[data-action="lofreq"]');
lofreqslider.oninput = function() {
    wavesurfer.setLoFreq(Number(this.value));
	document.getElementById('lofrequnits').innerHTML = Number(this.value)  + 'Hz';	
};	
	
var midfreqslider = document.querySelector('[data-action="midfreq"]');
midfreqslider.oninput = function() {
    wavesurfer.setMidFreq(Number(this.value));
	document.getElementById('midfrequnits').innerHTML = Number(this.value)  + 'Hz';	
};	

var hifreqslider = document.querySelector('[data-action="hifreq"]');
hifreqslider.oninput = function() {
    wavesurfer.setHiFreq(Number(this.value));
	document.getElementById('hifrequnits').innerHTML = Number(this.value)  + 'Hz';	
};		
	
var logainslider = document.querySelector('[data-action="logain"]');
logainslider.oninput = function() {
    wavesurfer.setLoGain(Number(this.value));
	document.getElementById('logainunits').innerHTML = Number(this.value)  + 'dB';	
};	
	
var midgainslider = document.querySelector('[data-action="midgain"]');
midgainslider.oninput = function() {
    wavesurfer.setMidGain(Number(this.value));
	document.getElementById('midgainunits').innerHTML = Number(this.value)  + 'dB';	
};	

var higainslider = document.querySelector('[data-action="higain"]');
higainslider.oninput = function() {
    wavesurfer.setHiGain(Number(this.value));
	document.getElementById('higainunits').innerHTML = Number(this.value)  + 'dB';	
};		
	
var midqslider = document.querySelector('[data-action="midq"]');
midqslider.oninput = function() {
    wavesurfer.setMidQ(Number(this.value));
	document.getElementById('midqunits').innerHTML = Number(this.value);	
};	

var ofile = document.querySelector('#openfile');	
ofile.onchange = function() {
	if (this.files.length) {
		wavesurfer.clearRegions();
        wavesurfer.loadBlob(this.files[0]);
		document.getElementById("filename").innerHTML = " " + this.files[0].name;
		filename = this.files[0].name;
		initControls();
    } else {
        wavesurfer.fireEvent('error', 'Not a file');
     }	
};
	
var scale = 'chromatic';
	
var rbtnc = document.querySelector('#rbtnC');
rbtnc.onclick = function() {
	scale = 'chromatic';
	wavesurfer.setScale('chromatic');
	changeMidiParams();
};		

var rbtnw = document.querySelector('#rbtnW');
rbtnw.onclick = function() {
	scale = 'white-note';
	wavesurfer.setScale('white-note');
	changeMidiParams();
};	

var rbtnb = document.querySelector('#rbtnB');
	rbtnb.onclick = function() {
	scale = 'black-note';
	wavesurfer.setScale('black-note');
	changeMidiParams();
};	

var logValue = function(position, minp, maxp, loval, hival) {
	var minv = Math.log(loval);
	var maxv = Math.log(hival);
	var scale = (maxv-minv) / (maxp-minp);
	return Math.exp(minv + scale*(position-minp));
};
	
var nearestWhiteNote = function(x) {
	if(x==1 || x==3 || x==6 || x==8 || x==10) {
		x = x-1;
	}
	return x;
};
	
var nearestBlackNote = function(x) {
 	if(x==0 || x==2 || x==5 || x==7 || x==9) {
		x = x+1;
	}
	if(x==11 || x==4) {
		x = x-1;
	}
	if(x==8 && sel2.selectedIndex==10) {
		x = x-2;
	}
	return x;	  
};

var availableNotes = function(x, s) {
	if(s == 'chromatic') {
		return 128 - x;
	}
	if(s == 'white-note') {
		var y = 75 - (Math.floor(x/12) * 7);
		var z = x%12; 
		if(z==0) y -=0;
		if(z==2) y -=1;
		if(z==4) y -=2;
		if(z==5) y -=3;
		if(z==7) y -=4;
		if(z==9) y -=5;
		if(z==11) y -=6;
	}	
	if(s == 'black-note') {
		var y = 53 - (Math.floor(x/12) * 5);
		var z = x%12; 
		if(z==1) y -=0;
		if(z==3) y -=1;
		if(z==6) y -=2;
		if(z==8) y -=3;
		if(z==10) y -=4;
	}	
	return y;
};
  
var changeMidiParams = function() {
	var s1 = sel1.selectedIndex;
	var s2 = sel2.selectedIndex;	
	if(s1>7 && s2 == 10) {
		s1 = 7;
		sel1.selectedIndex = 7;
	}
	if(scale == 'white-note') {
		s1 = nearestWhiteNote(s1);
		sel1.selectedIndex = s1;		
	}
	if(scale == 'black-note') {
		s1 = nearestBlackNote(s1);
		sel1.selectedIndex = s1;
	}	
	var t = sel1.options[s1].text + sel2.options[s2].text;
	document.getElementById('midibase').innerHTML = t;
	wavesurfer.setNoteNumber((s2 * 12) + s1);
	avnotes = availableNotes((s2 * 12) + s1, scale);
	document.getElementById('avnotes').innerHTML = avnotes;
	if(wavesurfer.getSlicesBetweenLocators() > avnotes) {
		document.getElementById('avnotewarn').innerHTML = '<small><b>Note: there are more slices than available MIDI notes in this setup; some will go unmapped (but will still be exported as WAV files).</b></small>';
	}
	else {
		document.getElementById('avnotewarn').innerHTML = '';
	}
 };

var changeTimeSig = function() {
	var s3 = sel3.selectedIndex;
	var s4 = sel4.selectedIndex;
	document.getElementById('timesig').innerHTML = sel3.options[s3].text + "/" + sel4.options[s4].text;
	wavesurfer.setTimingNum(sel3.options[s3].text);
	wavesurfer.setTimingDenom(sel4.options[s4].text);
	wavesurfer.setEstBpm();
	var estbpm = wavesurfer.getEstBpm();
	if(isNaN (estbpm)) document.getElementById('estbpm').innerHTML = '';
	else document.getElementById('estbpm').innerHTML = estbpm;
}; 
 
 
var sel1 = document.querySelector('#sel1');
sel1.onchange = function() {
	changeMidiParams();		
};	
	
var sel2 = document.querySelector('#sel2');
sel2.onchange = function() {
	changeMidiParams();
};		


var sel3 = document.querySelector('#sel3');
sel3.onchange = function() {
	changeTimeSig();
};	
	
var sel4 = document.querySelector('#sel4');
sel4.onchange = function() {
	changeTimeSig();
};		
	
var bar = document.querySelector('#bars');
bar.oninput = function() {
	if((bar.value < 1 || isNaN(bar.value)) && bar.value != '') {
		if(beat.value == 0) bar.value = 1;
	}
	wavesurfer.setTimingBars(bar.value);
	changeTimeSig();	
};

bar.onblur = function() {
	if(bar.value == '') {
		bar.value = 1;
		wavesurfer.setTimingBars(bar.value);
		changeTimeSig();		
	}
};

var beat = document.querySelector('#beats');
beat.oninput = function() {
	if((beat.value < 0 || isNaN(beat.value)) && beat.value != '') {
		beat.value = 0;
	}
	if(bar.value == 0 && beat.value == 0) {
		bar.value = 1;
		wavesurfer.setTimingBars(bar.value);
	}
	wavesurfer.setTimingExtraBeats(beat.value);	
	changeTimeSig();	
};
	
beat.onblur = function() {
	if(beat.value == '') {
		beat.value = 0;
		if(bar.value == 0 && beat.value == 0) bar.value = 1;
		wavesurfer.setTimingExtraBeats(beat.value);	
		changeTimeSig();		
	}
}

	
var initControls = function() {	
	transientslider.value = 48;

	temposlider.value = 1.0;	
	pitchslider.value = 0;	

	attackslider.value = 0;
	holdslider.value = 0;	
	decayslider.value = 10000;	

	compthresholdslider.value = 0;
	compratioslider.value = 1;
	compattackslider.value = 0.07; // 70ms
	compreleaseslider.value = 0.1;  // 100ms
	gainslider.value = 0;

	lofreqslider.value = 250;
	midfreqslider.value = 1000;
	hifreqslider.value = 4000;
	
	logainslider.value = 0;
	midgainslider.value = 0;
	higainslider.value = 0;
	
	midqslider.value = 1; 
	document.getElementById('thrshunits').innerHTML = '45';	
	document.getElementById('tempounits').innerHTML = '1x';
	document.getElementById('pitchunits').innerHTML = '0';
		
	document.getElementById('attackunits').innerHTML = '0ms';
	document.getElementById('holdunits').innerHTML = '0ms';	
	document.getElementById('decayunits').innerHTML = '∞';

	document.getElementById('compthresholdunits').innerHTML = '0db';
	document.getElementById('compratiounits').innerHTML = '1:1';
	document.getElementById('compattackunits').innerHTML = '70ms';
	document.getElementById('compreleaseunits').innerHTML = '100ms';
	document.getElementById('gainunits').innerHTML = '0dB';	
	
	document.getElementById('lofrequnits').innerHTML = '250Hz';
	document.getElementById('midfrequnits').innerHTML = '1000Hz';
	document.getElementById('hifrequnits').innerHTML = '4000Hz';
	
	document.getElementById('logainunits').innerHTML = '0db';
	document.getElementById('midgainunits').innerHTML = '0db';
	document.getElementById('higainunits').innerHTML = '0db';
	
	document.getElementById('midqunits').innerHTML = '1';	
	
	zoominbutton.disabled = false;
	zoomoutbutton.disabled = true;
	
	rbtnc.checked = true;
	sel1.selectedIndex = 0;
	sel2.selectedIndex = 0;	
	sel3.selectedIndex = 2;
	sel4.selectedIndex = 1;	
	scale = 'chromatic';
	avnotes = 127;
	
	document.getElementById('bars').value="1";
	document.getElementById('beats').value="0";
	document.getElementById('timesig').innerHTML = '4/4';	
};

document.addEventListener('DOMContentLoaded', initControls);

document.addEventListener('DOMContentLoaded', function() {
	if(bowser.chrome==true || bowser.opera==true) { 
	wavesurfer.setBrowser('chrome-opera');
	}
});

// Drag'n'drop
document.addEventListener('DOMContentLoaded', function () {
 
	var toggleActive = function (e, toggle) {
		e.stopPropagation();
		e.preventDefault();
		toggle ? e.target.classList.add('wavesurfer-dragover') :
		e.target.classList.remove('wavesurfer-dragover');
    };

    var handlers = {
        // Drop event
        drop: function (e) {
            toggleActive(e, false);

            // Load the file into wavesurfer
            if (e.dataTransfer.files.length) {
				wavesurfer.clearRegions();
                wavesurfer.loadBlob(e.dataTransfer.files[0]);
				document.getElementById("filename").innerHTML = " " + e.dataTransfer.files[0].name;
				filename = e.dataTransfer.files[0].name;
				// also set defaults again
				initControls();
            } else {
                wavesurfer.fireEvent('error', 'Not a file');
            }
        },

        // Drag-over event
        dragover: function (e) {
            toggleActive(e, true);
       },

        // Drag-leave event
        dragleave: function (e) {
           toggleActive(e, false);
        }
    };

    var dropTarget = document.querySelector('#waveform');
    Object.keys(handlers).forEach(function (event) {
        dropTarget.addEventListener(event, handlers[event]);
    });
});
