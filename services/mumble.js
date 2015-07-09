
var mumble = require('electron-mumble'),
    assert = require('assert'),
    util = require('util')

function MumbleService($q, storageService) {
    this.$q = $q
    this.storageService = storageService
    this.queue = []
    this.out_queue = []
    this.out_stream = null
    this.playing = false
    this.client = null
    this.startTime = 0
    this.audioContext = new AudioContext()
    this.inputFilter = this.audioContext.createBiquadFilter()

    console.log(util.inspect(this.audioContext))

    this.inputFilter.type = 'bandpass'
    this.inputFilter.frequency.value = 440
    this.inputFilter.gain.value = 5;

    this.outputGainNode = this.audioContext.createGain()
    this.outputGainNode.gain.value = 10;
    this.outputGainNode.connect(this.audioContext.destination)

    this.status = null
    this.error = null
    this.server = storageService.get('server')
    this.username = storageService.get('username')
    this.password = storageService.get('password')
}

function connect(server, username, password) {

    assert(!this.status, 'Cannot connect, invalid state: ' + this.status)

    var that = this
    var deferred = this.$q.defer()

    console.log('Connecting to: ' + server)
    this.status = 'connecting'
    this.error = null
    this.server = this.storageService.set('server', server)
    this.username = this.storageService.set('username', username)
    this.password = this.storageService.set('password', password)

    mumble.connect( server, {}, function ( error, _client ) {
        if( error ) {
            that.status = null
            that.error = error
            return deferred.reject(error)
        }

        console.log('connected.')
        console.log('authenticating as: ' + username)

        that.client = _client
        that.client.authenticate( username, password )
        that.client.on( 'voice', onVoice.bind(that) )
        that.client.on( 'initialized', function () {
            console.log('authenticated.')
            that.status = 'connected'
            navigator.webkitGetUserMedia({audio: true}, onUserMedia.bind(that), onError.bind(that))
            that.out_stream = that.client.inputStream()
            deferred.resolve()
        })
    })

    return deferred.promise
}

function disconnect() {
    if (this.client) {
        console.log('disconnecting.')

        //this.inputSource.disconnect(this.filter)
        //this.filter.disconnect(this.inputProcessor)
        //this.inputProcessor.disconnect(this.inputContext.destination)

        this.client.disconnect()
        this.client = null
        this.status = null
        this.error = null
    }
}

function onUserMedia (stream) {
    // Create the source and processor
    this.inputSource = this.audioContext.createMediaStreamSource(stream)
    this.inputProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)

    // Bind to the input filter
    this.inputSource.connect(this.inputFilter)
    this.inputFilter.connect(this.inputProcessor)

    // Bind to the audio context and onAudio function
    this.inputProcessor.connect(this.audioContext.destination)
    this.inputProcessor.onaudioprocess = onAudio.bind(this)
}

function onError (error) {
    console.log('Error getting user media: ' + error)
}

function onAudio( event ) {
    var data = event.inputBuffer.getChannelData(0)
    var size = data.length
    var pcmData = new Buffer(size * 2)
    var avg = 0
    for(var i = 0; i < size; i++) {
        var x = data[i] * 32768
        x = Math.min(Math.max(x, -32768), 32767)
        pcmData.writeInt16LE(x, i * 2)
    }

    // 0 out the outputBuffer so you don't hear yourself
    var output = event.outputBuffer
    for(var i = 0, n = output.leng; i < n; i++) {
        output[i] = 0
    }

    this.send(pcmData)
}

function onVoice( pcmData ) {
    var size = pcmData.length / 2
    var data = new Float32Array(size)
    for(var i = 0; i < size; i++) {
        data[i] = pcmData.readInt16LE( i * 2 ) / 32768
    }

    if (this.playing || this.queue.length > 0) {
       this.queue.push(data);
    } else {
       this.play(data)
    }
}

function send(data) {
    this.out_stream.write(data)
}

function playNext() {
    if (this.queue.length > 0) {
        var data = this.queue.shift()
        this.play(data)
    } else {
        this.playing = false
    }        
}

function play(data) {
    this.playing = true

    var buffer = this.audioContext.createBuffer(1, data.length, this.client.connection.SAMPLING_RATE)
    buffer.getChannelData(0).set(data)

    var source = this.audioContext.createBufferSource()
    source.connect(this.outputGainNode)
    source.onended = playNext.bind(this)
    source.buffer = buffer
    source.start(this.startTime)
    this.startTime += (buffer.duration - .005)
}


MumbleService.prototype.connect = connect
MumbleService.prototype.disconnect = disconnect
MumbleService.prototype.play = play
MumbleService.prototype.playNext = playNext
MumbleService.prototype.send = send
//MumbleService.prototype.sendNext = sendNext
module.exports = MumbleService