'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    var options = {
        container     : document.querySelector('#waveform'),
        waveColor     : 'black',
        progressColor : 'black',
        cursorColor   : 'red',
		splitChannels: true,
		height : 120
    };

    wavesurfer.init(options);
    // Load audio from URL 
    wavesurfer.load('examples/ol2.wav');

});

wavesurfer.on('ready', function () {
	wavesurfer.clearRegions();
	wavesurfer.resetThreshold();
	wavesurfer.initLR();
	wavesurfer.setThreshold(45);	// this is where first marker-drawing happens	
	wavesurfer.zoom(50);
	wavesurfer.setTempo(1.0);
	wavesurfer.setPitch(1.0);
	wavesurfer.setEnvAttack(0);
	wavesurfer.setEnvHold(0);	
	wavesurfer.setEnvDecay(10000);
	wavesurfer.setCompThreshold(0);
	wavesurfer.setCompRatio(1);
	wavesurfer.setCompAttack(0.07);
	wavesurfer.setCompRelease(0.1);
	wavesurfer.setVolume(1);
	wavesurfer.setLoFreq(250);
	wavesurfer.setMidFreq(1000);
	wavesurfer.setHiFreq(4000);
	wavesurfer.setLoGain(0);
	wavesurfer.setMidGain(0);
	wavesurfer.setHiGain(0);
	wavesurfer.setMidQ(1);	
	
	wavesurfer.setScale('chromatic');
	wavesurfer.setNoteNumber(0);
	wavesurfer.initTiming();
	wavesurfer.setEstBpm();	
});


wavesurfer.on('error', function (err) {
    console.error("wv err:" + err);
});

wavesurfer.on('finished-render', function () {
	savebutton.disabled=false;
	$('#saveModal').modal('hide');
});


/* Progress bar */
document.addEventListener('DOMContentLoaded', function () {
    var progressDiv = document.querySelector('#progress-bar');
    var progressBar = progressDiv.querySelector('.progress-bar');
    var progressMode = document.querySelector('#progressmode');
 
	var showProgress = function (percent, mode) {		
        progressDiv.style.display = 'block';
		progressMode.style.display = 'block';
        progressBar.style.width = percent + '%';
		progressMode.innerHTML = "<h3>" + mode  + " "  + percent + '%</h3>';
    };

    var hideProgress = function () {
        progressDiv.style.display = 'none';
		progressMode.style.display = 'none';
    };

 	wavesurfer.on('loading', function(percent) {
		showProgress(percent, 'Loading'); 
	});
	
 	wavesurfer.on('analysing', function(percent) {
		showProgress(percent, 'Analysing'); 
	});	
	
    wavesurfer.on('ready', hideProgress);
    wavesurfer.on('destroy', hideProgress);
    wavesurfer.on('error', hideProgress);
});

document.addEventListener('DOMContentLoaded', function () {
	if(!wavesurfer.backend.supportsWebAudio()) {
		document.getElementById("incompat").style.display="block";
	}
	if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
		document.getElementById("incompat").style.display="block";		
	}
});
