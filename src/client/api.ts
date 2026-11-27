import type { RoadDecoration, RoadModel, RoadSegment, TrafficVehicleModel } from '../data/models'

export const defaultRoadLength = 10

function getQueryInteger(params: URLSearchParams, key: string): number | undefined {
    const value = params.get(key)
    if (value === null || !/^\d+$/.test(value)) return undefined
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : undefined
}

export function getRoadQuery(search: string): { length: number; seed?: number } {
    const params = new URLSearchParams(search)
    const length = getQueryInteger(params, 'length')
    return {
        length: length !== undefined && length >= 2 ? length : defaultRoadLength,
        seed: getQueryInteger(params, 'seed')
    }
}

export type RoadResponse = { path: RoadSegment[]; decorations: RoadDecoration[] }

async function getJson<T>(path: string): Promise<T> {
    const url = `/api${path}`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`)
    }

    return (await response.json()) as T
}

export const getRoadParts = (): Promise<RoadModel[]> => getJson('/road_parts')
export const getRoad = (length: number, seed?: number): Promise<RoadResponse> =>
    getJson(`/road/${length}${seed === undefined ? '' : `?seed=${seed}`}`)
export const getRoadShowcase = (): Promise<RoadResponse> => getJson('/road/showcase')
export const getTrafficVehicleModels = (): Promise<TrafficVehicleModel[]> => getJson('/traffic_vehicles')
export const getVehicleModels = (): Promise<TrafficVehicleModel[]> => getJson('/vehicles')
