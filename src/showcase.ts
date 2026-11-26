import { Vector3 } from 'three'
import type { RoadSegment } from './data'

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

// Everything in models/road that is not a road surface is a showcase prop:
// street lights, construction gear, bridge pillars, and ground tiles.
export function isShowcaseProp(name: string): boolean {
    return !name.startsWith('road_')
}

// Lamp-head centers in the centered model coordinate space (node Z offset removed).
// Curved lamps sit at Y = 0.653, square ones at Y = 0.575.
export const streetLightHeads: Record<string, Vector3[]> = {
    light_curved: [new Vector3(0, 0.653, 0.15)],
    light_curvedDouble: [new Vector3(0, 0.653, 0.15), new Vector3(0, 0.653, -0.15)],
    light_curvedCross: [
        new Vector3(0, 0.653, 0.15),
        new Vector3(0, 0.653, -0.15),
        new Vector3(0.15, 0.653, 0),
        new Vector3(-0.15, 0.653, 0)
    ],
    light_square: [new Vector3(0, 0.575, 0.162)],
    light_squareDouble: [new Vector3(0, 0.575, 0.162), new Vector3(0, 0.575, -0.162)],
    light_squareCross: [
        new Vector3(0, 0.575, 0.162),
        new Vector3(0, 0.575, -0.162),
        new Vector3(0.162, 0.575, 0),
        new Vector3(-0.162, 0.575, 0)
    ],
    construction_light: [new Vector3(0, 0.21, 0)]
}

/**
 * Places display items in two orderly lanes beside the road, one item per slot.
 * The widest prop is a 1 x 1 ground tile and the longest vehicle is about 0.7
 * units, so the default 1.5-unit spacing leaves clear gaps between neighbors.
 */
export function createShowcasePlacements(
    segments: RoadSegment[],
    count: number,
    layout: ShowcaseLayout,
    spacing = 1.5
): ShowcasePlacement[] {
    if (count < 1 || segments.length < 1) return []

    const xs = segments.map((segment) => segment.position.x)
    const zs = segments.map((segment) => segment.position.z)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const maxZ = Math.max(...zs)
    const placements: ShowcasePlacement[] = []

    for (let index = 0; index < count; index++) {
        const left = index % 2 === 0
        const row = Math.floor(index / 2)
        const rotation =
            typeof layout.rotation === 'number' ? layout.rotation : left ? layout.rotation.left : layout.rotation.right

        placements.push({
            position: new Vector3(
                left ? minX - layout.offset : maxX + layout.offset,
                0,
                maxZ - spacing - row * spacing
            ),
            rotation
        })
    }

    return placements
}
