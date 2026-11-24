const express = require('express')
const app = express()
const port = 3210

const path = require('path')

const { Road } = require('./classes')

const { getRoadParts } = require('./utils')

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'))
})

app.get('/road/:length', (req, res) => {
    const length = Number(req.params.length)
    if (!Number.isInteger(length) || length < 2) {
        return res.status(400).json({ error: 'Road length must be an integer of at least 2' })
    }

    Road.build(length)
        .then((road) => {
            res.json(road.getPath())
        })
        .catch((err) => {
            console.error(err)
            res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
        })
})

app.get('/road_parts', (req, res) => {
    getRoadParts()
        .then((parts) => res.json(parts))
        .catch((err) => {
            console.error(err)
            res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
        })
})

app.get('/model/:type/:model', (req, res, next) => {
    const { model, type } = req.params

    const options = {
        root: path.join(__dirname, 'models/' + type),
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
