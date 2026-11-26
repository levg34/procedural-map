import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { RoadSegment } from '../src/data/models'
import { getGroundBounds } from '../src/client/ground'

function segment(x: number, z: number): RoadSegment {
    return {
        name: 'road_straight',
        position: { x, y: 0, z },
        directions: [],
        usedDirections: [],
        connectionOffsets: []
    }
}

describe('grass ground', () => {
    it('should cover every road position with the requested margin', () => {
        assert.deepStrictEqual(getGroundBounds([segment(0, 0), segment(4, -6)], 2), {
            centerX: 2,
            centerZ: -3,
            width: 8,
            depth: 10
        })
    })

    it('should fall back to a unit tile when there are no segments', () => {
        assert.deepStrictEqual(getGroundBounds([], 2), { centerX: 0, centerZ: 0, width: 1, depth: 1 })
    })
})
