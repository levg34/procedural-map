import type { RoadPathSegment } from './vehiclePath'

export type RoadModel = {
    url: string
    name: string
}

export type TrafficVehicleModel = RoadModel

export type RoadSegment = RoadPathSegment

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`)
    }

    return (await response.json()) as T
}

export const getRoadParts = (): Promise<RoadModel[]> => getJson('/road_parts')
export const getRoad = (length: number): Promise<RoadSegment[]> => getJson(`/road/${length}`)
export const getRoadShowcase = (): Promise<RoadSegment[]> => getJson('/road/showcase')
export const getRoadCircuit = (shape?: string): Promise<RoadSegment[]> =>
    getJson(shape ? `/road/circuit?shape=${encodeURIComponent(shape)}` : '/road/circuit')
export const getTrafficVehicleModels = (): Promise<TrafficVehicleModel[]> => getJson('/traffic_vehicles')
