import { Vector3 } from 'three'
import type { RoadSegment } from '../data/models'

// Angled toward the road from each side, keeping headlights off the neighboring
// display row while leaving the tail lights visible.
export const showcaseVehicleRotations = {
    left: -Math.PI / 4,
    right: Math.PI / 4
}

export const showcaseSpacing = 1.5
export const showcaseVehicleOffset = 1.7
// Clearance between display-model bounds, and enough lane separation for 3x3
// pieces to miss the widest parked vehicle (~0.34 radius).
export const showcaseDisplayGap = 0.5
export const showcaseDisplayOffset = 3.8

export type ShowcasePlacement = {
    position: Vector3
    rotation: number
}

export type ShowcaseLayout = {
    // Distance from the road's outer X extent to the display lane.
    offset: number
    // Distance between neighboring items in a lane.
    spacing?: number
    rotation: number | { left: number; right: number }
}

// The showcase road path already contains every connectable road piece. Anything
// else in the catalog (non-road props and road variants that cannot be connected)
// goes into the display lanes beside it.
export function isShowcaseDisplayModel(name: string, showcasePathNames: ReadonlySet<string>): boolean {
    return !showcasePathNames.has(name)
}

/**
 * Places display items in two orderly lanes beside the road, one item per slot.
 * Each row is sized from the largest footprint in that row so wide road variants
 * never overlap their neighbors. `sizes` are footprint radii (half the larger
 * X/Z dimension); when omitted, items are treated as points and only `spacing`
 * separates them.
 */
export function createShowcasePlacements(
    segments: RoadSegment[],
    count: number,
    layout: ShowcaseLayout,
    spacing = showcaseSpacing,
    sizes: number[] = []
): ShowcasePlacement[] {
    if (count < 1 || segments.length < 1) return []

    const xs = segments.map((segment) => segment.position.x)
    const zs = segments.map((segment) => segment.position.z)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const maxZ = Math.max(...zs)
    const placements: ShowcasePlacement[] = []
    let rowCenterZ = maxZ
    let previousRowRadius = 0

    for (let index = 0; index < count; index++) {
        const left = index % 2 === 0
        const row = Math.floor(index / 2)
        const rotation =
            typeof layout.rotation === 'number' ? layout.rotation : left ? layout.rotation.left : layout.rotation.right

        if (left) {
            const first = sizes[row * 2] ?? 0
            const second = sizes[row * 2 + 1] ?? 0
            const rowRadius = Math.max(first, second)
            rowCenterZ -= previousRowRadius + rowRadius + spacing
            previousRowRadius = rowRadius
        }

        placements.push({
            position: new Vector3(left ? minX - layout.offset : maxX + layout.offset, 0, rowCenterZ),
            rotation
        })
    }

    return placements
}
