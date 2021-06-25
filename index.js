const express = require('express')
const app = express()
const port = 3210

const path = require('path')

const { Road } = require('./classes')

const { getRoadParts } = require('./utils')

app.use(express.static(path.join(__dirname,'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'index.html'))
})

app.get('/road/:length', (req, res) => {
    const length = req.params.length ? req.params.length : 5
    Road.build(length).then(road => {
        res.json(road.getPath())
    }).catch(err => res.status(500).json({error: err}))
})

app.get('/road_parts', (req, res) => {
    getRoadParts().then(parts => res.json(parts)).catch(err => res.status(500).json({error: err}))
})

app.get('/model/:type/:model', (req, res, next) => {
    const {model, type} = req.params

    const options = {
        root: path.join(__dirname, 'models/'+type),
        dotfiles: 'deny',
        headers: {
          'x-timestamp': Date.now(),
          'x-sent': true
        }
    }

    res.sendFile(model, options, function (err) {
        if (err) {
            next(err)
        } else {
            console.log('Sent:', model)
        }
    })
})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})