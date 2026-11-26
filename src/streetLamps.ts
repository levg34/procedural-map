import { CurvePath, Vector3 } from 'three'

export type StreetLampPlacement = {
    position: Vector3
    rotation: number
}

const up = new Vector3(0, 1, 0)

/**
 * Places evenly spaced lamps on both sides of a generated road path. The lamp
 * model's arm extends along local +Z, so each rotation points it back at the road.
 */
export function createRoadsideLampPlacements(
    path: CurvePath<Vector3>,
    spacing = 4,
    offset = 1.1
): StreetLampPlacement[] {
    const length = path.getLength()
    if (length < spacing) return []

    const count = Math.floor(length / spacing)
    const placements: StreetLampPlacement[] = []

    for (let index = 0; index < count; index++) {
        const progress = (index + 0.5) / count
        const point = path.getPointAt(progress)
        const tangent = path.getTangentAt(progress).normalize()
        const right = tangent.clone().cross(up).normalize()

        for (const side of [-1, 1]) {
            const away = right.clone().multiplyScalar(side * offset)
            const toRoad = away.clone().negate()
            placements.push({
                position: point.clone().add(away),
                rotation: Math.atan2(toRoad.x, toRoad.z)
            })
        }
    }

    return placements
}
