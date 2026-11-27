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
    offset = 1.1,
    roundaboutCenters: Vector3[] = []
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

        const nearestRoundaboutCenter = roundaboutCenters
            .map((center) => ({ center, distance: point.distanceTo(center) }))
            .sort((a, b) => a.distance - b.distance)[0]

        const isNearRoundabout = nearestRoundaboutCenter ? nearestRoundaboutCenter.distance < 2.0 : false

        for (const side of [-1, 1]) {
            const away = right.clone().multiplyScalar(side * offset)

            if (isNearRoundabout && nearestRoundaboutCenter) {
                const radial = point.clone().sub(nearestRoundaboutCenter.center)
                if (radial.lengthSq() > 0.000001 && away.dot(radial) <= 0) continue
            }

            const toRoad = away.clone().negate()
            placements.push({
                position: point.clone().add(away),
                rotation: Math.atan2(toRoad.x, toRoad.z)
            })
        }
    }

    return placements
}
