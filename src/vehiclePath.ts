import { CubicBezierCurve3, CurvePath, LineCurve3, Vector3 } from 'three'

export type RoadVector = {
    x: number
    y: number
    z: number
}

export type RoadPathSegment = {
    name: string
    position: RoadVector
    rotation?: number
    directions: RoadVector[]
    usedDirections: RoadVector[]
    connectionOffsets: RoadVector[]
}

function getConnector(segment: RoadPathSegment, direction: RoadVector): Vector3 {
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

export function createRoadCenterPath(segments: RoadPathSegment[]): CurvePath<Vector3> {
    const connectedSegments = segments.filter((segment) => segment.usedDirections.length > 0)
    if (connectedSegments.length < 2) throw new Error('A road path requires at least two connected segments')

    const first = connectedSegments[0]
    const last = connectedSegments[connectedSegments.length - 1]
    if (!first || !last) throw new Error('Road path is missing an endpoint')

    const firstDirection = first.usedDirections[0]
    const lastDirection = last.usedDirections[0]
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
        const entryDirection = segment?.usedDirections[0]
        const exitDirection = segment?.usedDirections[1]
        if (!segment || !entryDirection || !exitDirection) {
            throw new Error(`Road segment ${segment?.name ?? index} is missing a route connector`)
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
            lastConnector.clone().addScaledVector(new Vector3(lastDirection.x, lastDirection.y, lastDirection.z), 0.5)
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
