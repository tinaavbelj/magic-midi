const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const serveStatic = require('serve-static')
const fs = require('fs')
const midi = require('jsmidgen')

// server setup
const app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(serveStatic(__dirname))

// api: define options
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS')
    next()
})

// api: download midi file
app.get('/api/midi/:id', function (req, res) {
  if (!req.params.id) {
    // send error response
    res.status(400)
    res.json({ message: `Parameter 'id' is required` })
  } else {
    // define file path
    const file = __dirname + '/files/' + req.params.id + '.mid'

    if (fs.existsSync(file)) {
      // send response
      res.download(file)
    } else {
      // send eror response
      res.status(404)
      res.json({ message: `Midi file with id '${req.params.id}' does not exist` })
    }
  }
})

// api: create & save midi file
app.post('/api/midi', function (req, res) {
  // beats per minute
  const BPM = 120
  // pulse per quarter note
  const PPQ = 128

  const ratio = 60000 / (BPM * PPQ)

  if (!req.body.parameters || !req.body.programs || !req.body.notes) {
    // send error response
    res.status(400)
    res.json({ message: 'Invalid Midi record format' })
  } else {
    // extract params
    const NOTE_ON = req.body.parameters.NOTE_ON
    const NOTE_OFF = req.body.parameters.NOTE_OFF
    const NOTE_VELOCITY = req.body.parameters.NOTE_VELOCITY
    let programs = req.body.programs
    let notes = req.body.notes

    // create midi file and track
    const track = new midi.Track()
    const file = new midi.File()
    file.addTrack(track)

    // set tempo
    track.setTempo(BPM)

    // set channel instruments
    for (let program of programs) {
      track.setInstrument(program.channel, program.program)
    }

    // set events
    let previousTime = 0
    for (let note of notes) {
      let elapsedTime = note.time - previousTime

      switch (note.event) {
        case NOTE_ON:
          track.addNoteOn(note.channel, note.pitch, elapsedTime / ratio, NOTE_VELOCITY)
          break
        case NOTE_OFF:
          track.addNoteOff(note.channel, note.pitch, elapsedTime / ratio, NOTE_VELOCITY)
          break
      }

      previousTime = note.time
    }

    // create dir
    const dir = __dirname + '/files/'
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    // save file
    const indices = fs.readdirSync(dir)
                      .filter(file => file.split('.')[1] === 'mid')
                      .map(file => parseInt(file.split('.')[0]))
    const id = indices.length > 0 ? Math.max(...indices) + 1 : 0
    const filename = id + '.mid'
    fs.writeFileSync(dir + filename, file.toBytes(), 'binary')

    // send response
    res.json({ id: id })
  }
})

// run server
const port = process.env.PORT
app.listen(port, () => console.log('Server running on port ' + port + '...'))
