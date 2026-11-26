import express from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Road } from './classes'
import { getAllVehicleModels, getRoadParts, getTrafficVehicleModels } from './utils'

const app = express()
const api = express.Router()
const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const port = 3210

app.use(express.static(join(rootDirectory, 'public')))

app.get(['/', '/showcase'], (_req, res) => {
    res.sendFile(join(rootDirectory, 'public', 'index.html'))
})

api.get('/road/showcase', async (_req, res) => {
    try {
        const road = await Road.buildShowcase()
        res.json(road.getPath())
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
})

api.get('/road/:length', async (req, res) => {
    const length = Number(req.params.length)
    if (!Number.isInteger(length) || length < 2) {
        res.status(400).json({ error: 'Road length must be an integer of at least 2' })
        return
    }

    try {
        const road = await Road.build(length)
        res.json(road.getPath())
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
})

api.get('/road_parts', async (_req, res) => {
    try {
        res.json(await getRoadParts())
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
})

api.get('/traffic_vehicles', async (_req, res) => {
    try {
        res.json(await getTrafficVehicleModels())
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
})

api.get('/vehicles', async (_req, res) => {
    try {
        res.json(await getAllVehicleModels())
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
})

app.get('/model/:type/:model', (req, res, next) => {
    const { model, type } = req.params

    res.sendFile(
        model,
        {
            root: join(rootDirectory, 'models', type),
            dotfiles: 'deny',
            headers: {
                'x-timestamp': String(Date.now()),
                'x-sent': 'true'
            }
        },
        (error) => {
            if (error) {
                next(error)
            } else {
                console.log('Sent:', model)
            }
        }
    )
})

app.use('/api', api)

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})
