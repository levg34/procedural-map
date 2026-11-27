import type { Vector3 } from 'three'
import type { RoadFootprint } from './road'

export type ModelMetadata = {
    url: string
    name: string
}

export type RoadPartMetadata = ModelMetadata & {
    directions?: Vector3[]
    footprint?: RoadFootprint
    connectionOffsets?: Vector3[]
}

export type RoadModel = ModelMetadata
export type TrafficVehicleModel = ModelMetadata

export type RoadVector = {
    x: number
    y: number
    z: number
}

// Wire format shared by the road generator and the browser client.
export type RoadSegment = {
    name: string
    position: RoadVector
    rotation?: number
    directions: RoadVector[]
    usedDirections: RoadVector[]
    connectionOffsets: RoadVector[]
}

export type RoadDecoration = {
    name: string
    position: RoadVector
    rotation?: number
}
