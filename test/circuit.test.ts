import assert from 'node:assert/strict'
import { CurvePath, Vector3 } from 'three'
import { beforeAll, describe, it } from 'vitest'
import { LinkedRoadPart, Road } from '../classes'
import { createRoadCenterPath } from '../src/vehiclePath'
import { vectors3Equals } from './testUtils'

const round = (part: LinkedRoadPart): string => `${part.position.x.toFixed(4)},${part.position.z.toFixed(4)}`

function connector(part: LinkedRoadPart, direction: Vector3): Vector3 {
    const match = part.directions.find((candidate) => candidate.distanceToSquared(direction) < 0.000001)
    if (!match) throw new Error(`Missing direction on ${part.name}`)
    return part.position.clone().add(part.getConnectionOffset(match))
}

function uniqueTiles(path: LinkedRoadPart[]): LinkedRoadPart[] {
    const tiles = new Map<string, LinkedRoadPart>()
    for (const part of path) {
        const key = `${round(part)}:${part.name}`
        let existing = tiles.get(key)
        if (!existing) {
            existing = new LinkedRoadPart(part, part.position)
            tiles.set(key, existing)
        }
        for (const direction of part.usedDirections) {
            const match = existing.directions.find((candidate) => candidate.distanceToSquared(direction) < 0.000001)
            if (match && !existing.usedDirections.includes(match)) existing.usedDirections.push(match)
        }
    }
    return [...tiles.values()]
}

describe('Circuit road', () => {
    let road: Road
    let path: LinkedRoadPart[]
    let tiles: LinkedRoadPart[]

    beforeAll(async () => {
        road = await Road.buildCircuit()
        path = road.getPath()
        tiles = uniqueTiles(path)
    })

    it('builds a closed route with a roundabout and a crossroad visited twice', () => {
        assert.deepStrictEqual(path.filter((part) => part.name === 'road_roundabout').length, 2)
        assert.deepStrictEqual(path.filter((part) => part.name === 'road_crossroad').length, 2)
        assert.ok(tiles.length > 20)
        assert.ok(new Set(tiles.map((tile) => tile.name)).size >= 8)

        const first = path[0]
        const last = path[path.length - 1]
        assert.ok(first && last)
        assert.ok(vectors3Equals(first.usedDirections[0].clone().add(last.usedDirections[1]), new Vector3()))
    })

    it('leaves no connector unused and pairs every connection at the same point', () => {
        for (const tile of tiles) {
            assert.deepStrictEqual(tile.getAvailableDirections().length, 0, `${tile.name} has an open connector`)
        }

        for (let index = 1; index < path.length; index++) {
            const previous = path[index - 1]
            const current = path[index]
            assert.ok(previous && current)
            const exit = previous.usedDirections[1]
            const entry = current.usedDirections[0]
            assert.ok(vectors3Equals(exit.clone().add(entry), new Vector3()))
            assert.ok(vectors3Equals(connector(previous, exit), connector(current, entry)))
        }
    })

    it('does not overlap its tiles', () => {
        for (let index = 0; index < tiles.length; index++) {
            const tile = tiles[index]
            assert.ok(tile)
            const footprint = tile.getFootprint()
            for (let otherIndex = index + 1; otherIndex < tiles.length; otherIndex++) {
                const other = tiles[otherIndex]
                assert.ok(other)
                const otherFootprint = other.getFootprint()
                const overlapsX =
                    Math.abs(tile.position.x - other.position.x) <
                    (footprint.width + otherFootprint.width) / 2 - 0.000001
                const overlapsZ =
                    Math.abs(tile.position.z - other.position.z) <
                    (footprint.depth + otherFootprint.depth) / 2 - 0.000001
                assert.ok(!overlapsX || !overlapsZ, `${tile.name} and ${other.name} overlap`)
            }
        }
    })

    it('creates a closed vehicle path in both directions', () => {
        for (const reverse of [false, true]) {
            const centerPath = createRoadCenterPath(path, reverse, true)
            const start = centerPath.getPointAt(0)
            const end = centerPath.getPointAt(1)
            const startTangent = centerPath.getTangentAt(0).normalize()
            const endTangent = centerPath.getTangentAt(1).normalize()

            assert.ok(start.distanceTo(end) < 0.000001, 'The circuit path should be closed')
            assert.ok(startTangent.dot(endTangent) > 0.99999, 'The circuit path should have a continuous tangent')
            assert.ok(centerPath.curves.filter((curve) => curve instanceof CurvePath).length === 2)
        }
    })

    it('rejects unknown shapes', async () => {
        await assert.rejects(() => Road.buildCircuit('missing'), /Unknown circuit shape/)
    })
})
