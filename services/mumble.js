
var mumble = require('electron-mumble'),
    assert = require('assert'),
    util = require('util')

function MumbleService($q, storageService) {
    this.$q = $q
    this.storageService = storageService
    this.queue = []
    this.playing = false
    this.client = null
    this.startTime = 0
    this.context = new AudioContext()

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
            deferred.resolve()
        })
    })

    return deferred.promise
}

function disconnect() {
    if (this.client) {
        console.log('disconnecting.')
        this.client.disconnect()
        this.client = null
        this.status = null
        this.error = null
    }
}

function onUserMedia (stream) {

    var client = this.client
    var source = this.context.createMediaStreamSource(stream)
    var proc = this.context.createScriptProcessor(256, 1, 1)
    source.connect(proc)
    proc.connect(this.context.destination)
    proc.onaudioprocess = function (event) {
        var data = event.inputBuffer.getChannelData(0)
        if(data) {
            var size = data.length
            var pcmData = new Buffer(size * 2)
            for(var i = 0; i < size; i++) {
                var x = data[i] * 32768
                pcmData.writeInt16LE(x, i * 2)
            }

            if (client) {
                client.sendVoice(pcmData)
            } else {
                proc.disconnect(source)
                source.disconnect(proc)
            }
        }
    }
}

function onError (error) {
    console.log('Error getting user media: ' + error)
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

    var buffer = this.context.createBuffer(1, data.length, this.client.connection.SAMPLING_RATE)
    buffer.getChannelData(0).set(data)

    var source = this.context.createBufferSource()
    source.connect(this.context.destination)
    source.onended = playNext.bind(this)
    source.buffer = buffer
    source.start(this.startTime)
    this.startTime += buffer.duration
}


MumbleService.prototype.connect = connect
MumbleService.prototype.disconnect = disconnect
MumbleService.prototype.play = play
MumbleService.prototype.playNext = playNext
module.exports = MumbleService