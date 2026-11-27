import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Road } from './roadBuilder'
import { getAllVehicleModels, getRoadParts, getTrafficVehicleModels } from './utils'

const app = express()
const api = express.Router()
const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const port = 3210

function parseSeed(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined
    const seed = Number(value)
    return Number.isInteger(seed) && seed >= 0 ? seed : undefined
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

const asyncRoute =
    (handler: AsyncRequestHandler): RequestHandler =>
    (req, res, next) => {
        handler(req, res, next).catch(next)
    }

app.use(express.static(join(rootDirectory, 'public')))

app.get(['/', '/showcase'], (_req, res) => {
    res.sendFile(join(rootDirectory, 'public', 'index.html'))
})

api.get(
    '/road/showcase',
    asyncRoute(async (_req, res) => {
        const road = await Road.buildShowcase()
        res.json(road.getPath())
    })
)

api.get(
    '/road/:length',
    asyncRoute(async (req, res) => {
        const length = Number(req.params.length)
        if (!Number.isInteger(length) || length < 2) {
            res.status(400).json({ error: 'Road length must be an integer of at least 2' })
            return
        }

        const seed = parseSeed(req.query.seed) ?? Math.floor(Math.random() * 2 ** 32)
        const road = await Road.build(length, seed)
        res.json(road.getPath())
    })
)

api.get(
    '/road_parts',
    asyncRoute(async (_req, res) => {
        res.json(await getRoadParts())
    })
)

api.get(
    '/traffic_vehicles',
    asyncRoute(async (_req, res) => {
        res.json(await getTrafficVehicleModels())
    })
)

api.get(
    '/vehicles',
    asyncRoute(async (_req, res) => {
        res.json(await getAllVehicleModels())
    })
)

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

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error)
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})
