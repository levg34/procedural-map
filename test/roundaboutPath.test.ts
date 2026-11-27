import assert from 'node:assert/strict'
import { CurvePath } from 'three'
import { describe, it } from 'vitest'
import type { RoadSegment, RoadVector } from '../src/data/models'
import { createRoadCenterPath } from '../src/client/vehiclePath'

function vector(x: number, z: number): RoadVector {
    return { x, y: 0, z }
}

function segment(
    name: string,
    position: RoadVector,
    directions: RoadVector[],
    usedDirections: RoadVector[],
    connectionOffsets: RoadVector[]
): RoadSegment {
    return { name, position, directions, usedDirections, connectionOffsets }
}

const roundaboutDirections = [vector(1, 0), vector(-1, 0), vector(0, 1), vector(0, -1)]
const roundaboutOffsets = [vector(1.5, 0), vector(-1.5, 0), vector(0, 1.5), vector(0, -1.5)]

function routeThroughRoundabout(entry: RoadVector, exit: RoadVector): RoadSegment[] {
    return [
        segment('start', vector(0, 0), [vector(0, 1)], [vector(0, 1)], [vector(0, 0.5)]),
        segment('road_roundabout', vector(0, 0), roundaboutDirections, [entry, exit], roundaboutOffsets),
        segment('end', vector(0, 0), [vector(1, 0)], [vector(1, 0)], [vector(0.5, 0)])
    ]
}

function usesRoundaboutCurve(route: ReturnType<typeof createRoadCenterPath>): boolean {
    return route.curves.some((curve) => curve instanceof CurvePath)
}

describe('roundabout route selection', () => {
    it('uses a bezier for the first exit and the roundabout curve for the third exit from the other side', () => {
        const segments = routeThroughRoundabout(vector(0, 1), vector(1, 0))

        assert.strictEqual(usesRoundaboutCurve(createRoadCenterPath(segments)), false)
        assert.strictEqual(usesRoundaboutCurve(createRoadCenterPath(segments, true)), true)
    })

    it('uses the roundabout curve for the second exit in both directions', () => {
        const segments = routeThroughRoundabout(vector(-1, 0), vector(1, 0))

        assert.strictEqual(usesRoundaboutCurve(createRoadCenterPath(segments)), true)
        assert.strictEqual(usesRoundaboutCurve(createRoadCenterPath(segments, true)), true)
    })

    it('uses the roundabout curve for a left exit but a bezier when that exit becomes the first exit in reverse', () => {
        const segments = routeThroughRoundabout(vector(-1, 0), vector(0, -1))

        assert.strictEqual(usesRoundaboutCurve(createRoadCenterPath(segments)), true)
        assert.strictEqual(usesRoundaboutCurve(createRoadCenterPath(segments, true)), false)
    })
})
