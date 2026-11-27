import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { defaultRoadLength, getRoadQuery } from '../src/client/api'

describe('getRoadQuery', () => {
    it('defaults to length 10 with no seed when the query is empty', () => {
        assert.deepStrictEqual(getRoadQuery(''), { length: defaultRoadLength, seed: undefined })
    })

    it('reads length and seed from the query', () => {
        assert.deepStrictEqual(getRoadQuery('?length=20&seed=42'), { length: 20, seed: 42 })
    })

    it('falls back to defaults for invalid values', () => {
        assert.deepStrictEqual(getRoadQuery('?length=1&seed=abc'), { length: defaultRoadLength, seed: undefined })
    })
})
