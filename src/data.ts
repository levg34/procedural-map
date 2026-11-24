export type RoadModel = {
    url: string
    name: string
}

export type RoadSegment = {
    name: string
    position: {
        x: number
        y: number
        z: number
    }
    rotation?: number
}

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`)
    }

    return (await response.json()) as T
}

export const getRoadParts = (): Promise<RoadModel[]> => getJson('/road_parts')
export const getRoad = (length: number): Promise<RoadSegment[]> => getJson(`/road/${length}`)
