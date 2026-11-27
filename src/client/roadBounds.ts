import type { RoadSegment } from '../data/models'

export type RoadBounds = {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
}

/** X/Z extents of the road's segment centers. An empty road collapses to the origin. */
export function getRoadBounds(segments: RoadSegment[]): RoadBounds {
    if (segments.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }

    const xs = segments.map((segment) => segment.position.x)
    const zs = segments.map((segment) => segment.position.z)

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
    }
}
