import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { getRoadBounds } from '../src/client/roadBounds'
import type { RoadSegment } from '../src/data/models'

function segment(x: number, z: number): RoadSegment {
    return {
        name: 'road_straight',
        position: { x, y: 0, z },
        directions: [],
        usedDirections: [],
        connectionOffsets: []
    }
}

describe('road bounds', () => {
    it('should report the full X/Z extent of the road segments', () => {
        assert.deepStrictEqual(getRoadBounds([segment(0, 0), segment(4, -6), segment(-2, 3)]), {
            minX: -2,
            maxX: 4,
            minZ: -6,
            maxZ: 3
        })
    })

    it('should collapse an empty road to the origin', () => {
        assert.deepStrictEqual(getRoadBounds([]), { minX: 0, maxX: 0, minZ: 0, maxZ: 0 })
    })

    it('should treat a single segment as a zero-size road', () => {
        assert.deepStrictEqual(getRoadBounds([segment(2, -3)]), { minX: 2, maxX: 2, minZ: -3, maxZ: -3 })
    })
})
