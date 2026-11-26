import type { RoadPathSegment, RoadVector } from './vehiclePath'

export type RoadModel = {
    url: string
    name: string
}

export type TrafficVehicleModel = RoadModel

export type RoadSegment = RoadPathSegment

export type RoadConnection = {
    from: number
    fromDirection: RoadVector
    to: number
    toDirection: RoadVector
    point: RoadVector
}

export type RoadNetwork = {
    size: number
    tiles: RoadSegment[]
    connections: RoadConnection[]
    routes: RoadSegment[][]
}

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`)
    }

    return (await response.json()) as T
}

export const getRoadParts = (): Promise<RoadModel[]> => getJson('/road_parts')
export const getRoadGrid = (size: number): Promise<RoadNetwork> => getJson(`/road/${size}`)
export const getRoadShowcase = (): Promise<RoadNetwork> => getJson('/road/showcase')
export const getTrafficVehicleModels = (): Promise<TrafficVehicleModel[]> => getJson('/traffic_vehicles')
