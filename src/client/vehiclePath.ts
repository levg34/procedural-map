import { CubicBezierCurve3, CurvePath, LineCurve3, Vector3 } from 'three'
import type { RoadSegment, RoadVector } from '../data/models'
import { createRoundaboutPath, isFirstExit } from './roundaboutPath'

export type RoadPath = CurvePath<Vector3>

function getConnector(segment: RoadSegment, direction: RoadVector): Vector3 {
    const index = segment.directions.findIndex(
        (candidate) =>
            Math.abs(candidate.x - direction.x) < 0.000001 &&
            Math.abs(candidate.y - direction.y) < 0.000001 &&
            Math.abs(candidate.z - direction.z) < 0.000001
    )
    const offset = segment.connectionOffsets[index]
    if (!offset) throw new Error(`Missing connector offset for ${segment.name}`)

    return new Vector3(segment.position.x + offset.x, segment.position.y + offset.y, segment.position.z + offset.z)
}

function getRouteDirections(segment: RoadSegment, reverse: boolean): RoadVector[] {
    return reverse ? [...segment.usedDirections].reverse() : segment.usedDirections
}

export function createRoadCenterPath(segments: RoadSegment[], reverse = false): RoadPath {
    const connectedSegments = segments.filter((segment) => segment.usedDirections.length > 0)
    if (reverse) connectedSegments.reverse()
    if (connectedSegments.length < 2) throw new Error('A road path requires at least two connected segments')

    const first = connectedSegments[0]
    const last = connectedSegments[connectedSegments.length - 1]
    if (!first || !last) throw new Error('Road path is missing an endpoint')

    const firstDirections = getRouteDirections(first, reverse)
    const lastDirections = getRouteDirections(last, reverse)
    const firstDirection = firstDirections[0]
    const lastDirection = lastDirections[0]
    if (!firstDirection || !lastDirection) throw new Error('Road endpoint is missing its connector direction')

    const curve = new CurvePath<Vector3>()
    const firstConnector = getConnector(first, firstDirection)
    curve.add(
        new LineCurve3(
            firstConnector
                .clone()
                .addScaledVector(new Vector3(firstDirection.x, firstDirection.y, firstDirection.z), -0.5),
            firstConnector
        )
    )

    for (let index = 1; index < connectedSegments.length - 1; index++) {
        const segment = connectedSegments[index]
        const directions = segment ? getRouteDirections(segment, reverse) : []
        const entryDirection = directions[0]
        const exitDirection = directions[1]
        if (!segment || !entryDirection || !exitDirection) {
            throw new Error(`Road segment ${segment?.name ?? index} is missing a route connector`)
        }

        if (segment.name === 'road_roundabout' && !isFirstExit(entryDirection, exitDirection)) {
            curve.add(createRoundaboutPath(segment, entryDirection, exitDirection, getConnector))
            continue
        }

        const start = getConnector(segment, entryDirection)
        const end = getConnector(segment, exitDirection)
        const startTangent = new Vector3(-entryDirection.x, -entryDirection.y, -entryDirection.z)
        const endTangent = new Vector3(exitDirection.x, exitDirection.y, exitDirection.z)
        const controlDistance = start.distanceTo(end) * 0.39052429175127

        curve.add(
            new CubicBezierCurve3(
                start,
                start.clone().addScaledVector(startTangent, controlDistance),
                end.clone().addScaledVector(endTangent, -controlDistance),
                end
            )
        )
    }

    const lastConnector = getConnector(last, lastDirection)
    curve.add(
        new LineCurve3(
            lastConnector,
            lastConnector.clone().addScaledVector(new Vector3(lastDirection.x, lastDirection.y, lastDirection.z), -0.5)
        )
    )

    return curve
}

export function getLanePosition(
    centerPath: RoadPath,
    progress: number,
    laneOffset: number,
    reverse = false
): { position: Vector3; tangent: Vector3 } {
    const pathProgress = reverse ? 1 - progress : progress
    const tangent = centerPath.getTangentAt(pathProgress).normalize()
    if (reverse) tangent.negate()

    const laneDirection = tangent
        .clone()
        .cross(new Vector3(0, 1, 0))
        .normalize()
    const position = centerPath.getPointAt(pathProgress).addScaledVector(laneDirection, laneOffset)

    return { position, tangent }
}

export function getTurnaroundPose(
    centerPath: RoadPath,
    progress: number,
    laneOffset: number
): { position: Vector3; tangent: Vector3 } {
    const center = centerPath.getPointAt(1)
    const tangent = centerPath.getTangentAt(1).normalize()
    const laneDirection = tangent
        .clone()
        .cross(new Vector3(0, 1, 0))
        .normalize()
    const angle = Math.PI * progress

    return {
        position: center
            .clone()
            .addScaledVector(laneDirection, laneOffset * Math.cos(angle))
            .addScaledVector(tangent, laneOffset * Math.sin(angle)),
        tangent: tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(laneDirection, -Math.sin(angle))
    }
}
