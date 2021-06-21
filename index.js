const express = require('express')
const app = express()
const port = 3210

const fs = require('fs')
const path = require('path')

const { Road } = require('./classes')

app.use(express.static(path.join(__dirname,'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'index.html'))
})

app.get('/road', (req, res) => {
    const road = new Road()
    road.createRoad()
    res.json(road)
})

app.get('/road_parts', (req, res) => {
    fs.readdir('./models/road',(err, files) => {
        if (err) return res.json({err})
        const models = files.filter(file => !file.endsWith('.txt')).map(file => 'road/'+file)
        res.json(models)
    })
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