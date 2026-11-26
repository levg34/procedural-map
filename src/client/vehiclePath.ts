import { CubicBezierCurve3, CurvePath, LineCurve3, Vector3 } from 'three'
import type { RoadSegment, RoadVector } from '../data/models'

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

function createRoundaboutPath(
    segment: RoadSegment,
    entryDirection: RoadVector,
    exitDirection: RoadVector
): CurvePath<Vector3> {
    // The vehicle's 0.16 right-lane offset puts it at radius 0.8 on the asphalt.
    const radius = 0.64
    const center = new Vector3(segment.position.x, segment.position.y, segment.position.z)
    const entryRadial = new Vector3(entryDirection.x, 0, entryDirection.z).normalize()
    const exitRadial = new Vector3(exitDirection.x, 0, exitDirection.z).normalize()
    const entryAngle = Math.atan2(-entryRadial.z, entryRadial.x)
    const exitAngle = Math.atan2(-exitRadial.z, exitRadial.x)
    const circleStartAngle = entryAngle + Math.PI / 4
    const circleEndAngle = exitAngle - Math.PI / 4
    const sweep = (circleEndAngle - circleStartAngle + 2 * Math.PI) % (2 * Math.PI)
    if (sweep < 0.000001) throw new Error('Roundabout route requires distinct entry and exit ports')

    const entry = getConnector(segment, entryDirection)
    const exit = getConnector(segment, exitDirection)
    const circlePoint = (angle: number): Vector3 =>
        center.clone().add(new Vector3(radius * Math.cos(angle), 0, -radius * Math.sin(angle)))
    const circleTangent = (angle: number): Vector3 => new Vector3(-Math.sin(angle), 0, -Math.cos(angle))
    const circleStart = circlePoint(circleStartAngle)
    const circleEnd = circlePoint(circleEndAngle)
    const entryTangent = new Vector3(-entryRadial.x, 0, -entryRadial.z)
    const exitTangent = new Vector3(exitDirection.x, 0, exitDirection.z).normalize()
    const transitionDistance = (entry.distanceTo(circleStart) + exit.distanceTo(circleEnd)) / 2
    const curve = new CurvePath<Vector3>()

    curve.add(
        new CubicBezierCurve3(
            entry,
            entry.clone().addScaledVector(entryTangent, transitionDistance * 0.55),
            circleStart.clone().addScaledVector(circleTangent(circleStartAngle), -transitionDistance * 0.55),
            circleStart
        )
    )

    let angle = circleStartAngle
    let remaining = sweep
    while (remaining > 0.000001) {
        const step = Math.min(remaining, Math.PI / 2)
        const nextAngle = angle + step
        const start = circlePoint(angle)
        const end = circlePoint(nextAngle)
        const controlDistance = (4 / 3) * Math.tan(step / 4) * radius

        curve.add(
            new CubicBezierCurve3(
                start,
                start.clone().addScaledVector(circleTangent(angle), controlDistance),
                end.clone().addScaledVector(circleTangent(nextAngle), -controlDistance),
                end
            )
        )

        angle = nextAngle
        remaining -= step
    }

    curve.add(
        new CubicBezierCurve3(
            circleEnd,
            circleEnd.clone().addScaledVector(circleTangent(circleEndAngle), transitionDistance * 0.55),
            exit.clone().addScaledVector(exitTangent, -transitionDistance * 0.55),
            exit
        )
    )

    return curve
}

export function createRoadCenterPath(segments: RoadSegment[], reverse = false): CurvePath<Vector3> {
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

        if (reverse && segment.name === 'road_roundabout') {
            curve.add(createRoundaboutPath(segment, entryDirection, exitDirection))
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
    centerPath: CurvePath<Vector3>,
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
    centerPath: CurvePath<Vector3>,
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
