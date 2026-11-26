import assert from 'node:assert/strict'
import { CurvePath, LineCurve3, Vector3 } from 'three'
import { describe, it } from 'vitest'
import { Road } from '../classes'
import { createRoadsideLampPlacements } from '../src/streetLamps'
import { createRoadCenterPath } from '../src/vehiclePath'

describe('roadside street lamps', () => {
    it('places lamps on both sides of the generated road with arms facing it', async () => {
        const road = await Road.build(10)
        const path = createRoadCenterPath(road.getPath())
        const spacing = 4
        const offset = 1.1
        const placements = createRoadsideLampPlacements(path, spacing, offset)
        const count = Math.floor(path.getLength() / spacing)

        assert.ok(count > 0)
        assert.equal(placements.length, count * 2)

        for (const [index, placement] of placements.entries()) {
            const progress = (Math.floor(index / 2) + 0.5) / count
            const point = path.getPointAt(progress)
            const toRoad = point.clone().sub(placement.position).normalize()
            const armDirection = new Vector3(Math.sin(placement.rotation), 0, Math.cos(placement.rotation))
            assert.ok(Math.abs(placement.position.distanceTo(point) - offset) < 0.000001)
            assert.ok(armDirection.distanceTo(toRoad) < 0.000001)
        }
    })

    it('skips roads shorter than one lamp spacing', () => {
        const path = new CurvePath<Vector3>()
        path.add(new LineCurve3(new Vector3(), new Vector3(2, 0, 0)))

        assert.deepEqual(createRoadsideLampPlacements(path, 4), [])
    })
})
