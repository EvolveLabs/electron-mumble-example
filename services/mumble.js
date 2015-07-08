
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
    this.outputContext = new AudioContext()
    this.inputContext = new AudioContext()

    this.status = null
    this.error = null
    this.server = storageService.get('server')
    this.username = storageService.get('username')
    this.password = null
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
    this.password = password

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

        this.inputSource.disconnect(this.intputProcessor)
        this.inputProcessor.disconnect(this.inputContext.destination)

        this.client.disconnect()
        this.client = null
        this.status = null
        this.error = null
    }
}

function onUserMedia (stream) {
    this.inputSource = this.inputContext.createMediaStreamSource(stream)
    this.inputProcessor = this.inputContext.createScriptProcessor(2048, 1, 1)
    this.inputSource.connect(this.inputProcessor)
    this.inputProcessor.connect(this.inputContext.destination)
    this.inputProcessor.onaudioprocess = onAudioIn.bind(this)
}

function onError (error) {
    console.log('Error getting user media: ' + error)
}

function onAudioIn( event ) {
    var data = event.inputBuffer.getChannelData(0)
    if(data) {
        var size = data.length
        var pcmData = new Buffer(size * 2)
        for(var i = 0; i < size; i++) {
            var x = data[i] * 32768
            ///x = Math.min(Math.max(x, -32768), 32767)
            x = Math.min(Math.max(x, -30000), 30000)
            pcmData.writeInt16LE(x, i * 2)
        }

        if (this.sending || this.out_queue.length > 0) {
            this.out_queue.push(pcmData);
            while(this.out_queue > 100) {
                this.out_queue.shift()
            }
        } else {
           this.send(pcmData)
        }
    }

    // var output = event.outputBuffer.getChannelData(0)
    // for(var i = 0, n = output.length; i < n; i++) {
    //     output[i] = 0
    // }
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

function sendNext() {
    if(this.out_queue.length > 0) {
        var data = this.out_queue.shift()
        this.send(data)
    } else {
        this.sending = false
    }
}

function send(data) {
    this.sending = true
    this.out_stream.write(data, sendNext.bind(this))
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

    var buffer = this.outputContext.createBuffer(1, data.length, this.client.connection.SAMPLING_RATE)
    buffer.getChannelData(0).set(data)

    var source = this.outputContext.createBufferSource()
    source.connect(this.outputContext.destination)
    source.onended = playNext.bind(this)
    source.buffer = buffer
    source.start(this.startTime)
    this.startTime += buffer.duration
}


MumbleService.prototype.connect = connect
MumbleService.prototype.disconnect = disconnect
MumbleService.prototype.play = play
MumbleService.prototype.playNext = playNext
MumbleService.prototype.send = send
MumbleService.prototype.sendNext = sendNext
module.exports = MumbleService