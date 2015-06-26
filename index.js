var mumble = require('electron-mumble')

var connect;

document.addEventListener('DOMContentLoaded', function () {

    var queue = []
    var playing = false
    var client = null
    var startTime = 0
    var actx = new AudioContext()

    connect = function () {

    var server = document.getElementById('server').value
    var username = document.getElementById('username').value
    var password = document.getElementById('password').value

    console.log('Connecting to: ' + server + '...')

    mumble.connect( server, {}, function ( error, _client ) {
        if( error ) { throw new Error( error ); }

        console.log( 'Connected' );

        client = _client
        client.authenticate( username, password );
        client.on( 'initialized', onInit );
        client.on( 'voice', onVoice );
    });

    var onInit = function() {
        console.log( 'Connection initialized' );
    };

    var onVoice = function( pcmData ) {
        var size = pcmData.length / 2
        var data = new Float32Array(size)
        for(var i = 0; i < size; i++) {
            data[i] = pcmData.readInt16LE( i * 2 ) / 32768
        }

        if (playing || queue.length > 0) {
            queue.push(data);
        } else {
            play(data)
        }
    }

    var playNext = function () {
        if(queue.length > 0) {
            var data = queue.shift()
            play(data)
        } else {
            playing = false
        }        
    }

    var play = function (data) {
        playing = true

        var buffer = actx.createBuffer(1, data.length, client.connection.SAMPLING_RATE)
        buffer.getChannelData(0).set(data)

        var source = actx.createBufferSource()
        source.connect(actx.destination)
        source.onended = playNext
        source.buffer = buffer
        source.start(startTime)
        startTime += buffer.duration
    }
    }
})