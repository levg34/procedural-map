import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Vector3 } from 'three'
import { roadTypes } from './roadData.ts'

export type RoadPartMetadata = {
    url: string
    name: string
    directions?: Vector3[]
}

const modelDirectory = join(dirname(fileURLToPath(import.meta.url)), 'models', 'road')
const configurations = Object.values(roadTypes)

export async function getRoadParts(): Promise<RoadPartMetadata[]> {
    const files = await readdir(modelDirectory)

    return files
        .filter((file) => file.endsWith('.glb'))
        .map((file) => {
            const name = file.slice(0, -4)
            const roadPart: RoadPartMetadata = {
                url: `/model/road/${file}`,
                name
            }
            const configuration = configurations.find((item) => item.for.includes(name))

            if (configuration) {
                roadPart.directions = configuration.directions.map((direction) => direction.clone())
            }

            return roadPart
        })
}
