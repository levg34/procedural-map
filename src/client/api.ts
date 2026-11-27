import type { RoadModel, RoadSegment, TrafficVehicleModel } from '../data/models'

async function getJson<T>(path: string): Promise<T> {
    const url = `/api${path}`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`)
    }

    return (await response.json()) as T
}

export const getRoadParts = (): Promise<RoadModel[]> => getJson('/road_parts')
export const getRoad = (length: number, seed?: number): Promise<RoadSegment[]> =>
    getJson(`/road/${length}${seed === undefined ? '' : `?seed=${seed}`}`)
export const getRoadShowcase = (): Promise<RoadSegment[]> => getJson('/road/showcase')
export const getTrafficVehicleModels = (): Promise<TrafficVehicleModel[]> => getJson('/traffic_vehicles')
export const getVehicleModels = (): Promise<TrafficVehicleModel[]> => getJson('/vehicles')
