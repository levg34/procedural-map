import { CubicBezierCurve3, CurvePath, Vector3 } from 'three'
import type { RoadSegment, RoadVector } from '../data/models'
import type { RoadPath } from './vehiclePath'

export type ConnectorResolver = (segment: RoadSegment, direction: RoadVector) => Vector3

export function isFirstExit(entryDirection: RoadVector, exitDirection: RoadVector): boolean {
    const entry = new Vector3(entryDirection.x, 0, entryDirection.z)
    const exit = new Vector3(exitDirection.x, 0, exitDirection.z)
    return entry.cross(exit).y > 0.000001
}

/** A curved route through a roundabout from one connector to another. */
export function createRoundaboutPath(
    segment: RoadSegment,
    entryDirection: RoadVector,
    exitDirection: RoadVector,
    getConnector: ConnectorResolver
): RoadPath {
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
