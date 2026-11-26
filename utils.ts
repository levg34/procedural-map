import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Vector3 } from 'three'
import { roadConnectionOffsets, roadFootprints, roadTypes } from './roadData'
import type { RoadFootprint } from './roadData'
import { isTrafficVehicleExcluded, isVehiclePart } from './trafficVehicleData'

export type ModelMetadata = {
    url: string
    name: string
}

export type RoadPartMetadata = ModelMetadata & {
    directions?: Vector3[]
    footprint?: RoadFootprint
    connectionOffsets?: Vector3[]
}

const modelDirectory = join(dirname(fileURLToPath(import.meta.url)), 'models', 'road')
const carModelDirectory = join(dirname(fileURLToPath(import.meta.url)), 'models', 'cars')
const configurations = Object.values(roadTypes)

export async function getRoadParts(): Promise<RoadPartMetadata[]> {
    const files = await readdir(modelDirectory)

    return files
        .filter((file) => file.endsWith('.glb'))
        .map((file) => {
            const name = file.slice(0, -4)
            const roadPart: RoadPartMetadata = {
                url: `/model/road/${file}`,
                name,
                footprint: roadFootprints[name] ?? { width: 1, depth: 1 },
                connectionOffsets: roadConnectionOffsets[name]?.map((offset) => offset.clone())
            }
            const configuration = configurations.find((item) => item.for.includes(name))

            if (configuration) {
                roadPart.directions = configuration.directions.map((direction) => direction.clone())
            }

            return roadPart
        })
}

export async function getTrafficVehicleModels(): Promise<ModelMetadata[]> {
    const files = await readdir(carModelDirectory)

    return files
        .filter((file) => file.endsWith('.glb'))
        .map((file) => ({
            url: `/model/cars/${file}`,
            name: file.slice(0, -4)
        }))
        .filter((model) => !isVehiclePart(model.name) && !isTrafficVehicleExcluded(model.name))
}
