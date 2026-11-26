import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { beforeAll, describe, it } from 'vitest'
import { Road } from '../classes'
import { buildRoadNetwork, generateRoadNetwork, minimumGridSize, networkFromPath } from '../roadGrid'
import type { GridTile, GridVector, RoadNetwork } from '../roadGrid'
import { createRoadCenterPath, getLanePosition } from '../src/vehiclePath'
import { getRoadParts } from '../utils'
import { doubleEquals, vectors3Equals } from './testUtils'

const vector = (value: GridVector): Vector3 => new Vector3(value.x, value.y, value.z)

function connectorPoint(tile: GridTile, direction: GridVector): Vector3 {
    const index = tile.directions.findIndex((candidate) => vectors3Equals(vector(candidate), vector(direction)))
    assert.ok(index >= 0, `${tile.name} has no connector in the given direction`)
    const offset = tile.connectionOffsets[index]
    assert.ok(offset)
    return vector(tile.position).add(vector(offset))
}

function connectedIds(network: RoadNetwork): Set<number> {
    const adjacency = new Map<number, number[]>()
    network.connections.forEach((connection) => {
        adjacency.set(connection.from, [...(adjacency.get(connection.from) ?? []), connection.to])
        adjacency.set(connection.to, [...(adjacency.get(connection.to) ?? []), connection.from])
    })
    const first = network.tiles[0]
    if (!first) return new Set()
    const visited = new Set([first.id])
    const queue = [first.id]
    while (queue.length > 0) {
        const current = queue.shift()
        if (current === undefined) continue
        for (const neighbor of adjacency.get(current) ?? []) {
            if (visited.has(neighbor)) continue
            visited.add(neighbor)
            queue.push(neighbor)
        }
    }
    return visited
}

describe('grid road network', () => {
    let network: RoadNetwork

    beforeAll(async () => {
        network = await buildRoadNetwork(10)
    })

    it('should require enough space for every road type', async () => {
        const parts = await getRoadParts()
        assert.strictEqual(minimumGridSize(parts), 8)
        assert.throws(() => generateRoadNetwork(parts, 7), /at least 8/)
    })

    it('should use every connectable road type', async () => {
        const parts = await getRoadParts()
        const expected = parts.filter((part) => part.directions && part.directions.length > 0).map((part) => part.name)
        const actual = new Set(network.tiles.map((tile) => tile.name))

        expected.forEach((name) => assert.ok(actual.has(name), `Missing ${name}`))
    })

    it('should leave no connector unused', () => {
        network.tiles.forEach((tile) => {
            assert.deepStrictEqual(tile.usedDirections.length, tile.directions.length)
            tile.directions.forEach((direction) => {
                assert.ok(
                    tile.usedDirections.some((used) => vectors3Equals(vector(used), vector(direction))),
                    `${tile.name} has an unused connector`
                )
            })
        })
    })

    it('should pair connectors at the same point in opposite directions', () => {
        const byId = new Map(network.tiles.map((tile) => [tile.id, tile]))
        network.connections.forEach((connection) => {
            const from = byId.get(connection.from)
            const to = byId.get(connection.to)
            assert.ok(from && to)
            assert.ok(
                vectors3Equals(vector(connection.fromDirection).negate(), vector(connection.toDirection)),
                `${from.name} and ${to.name} are not facing each other`
            )
            assert.ok(vectors3Equals(connectorPoint(from, connection.fromDirection), vector(connection.point)))
            assert.ok(vectors3Equals(connectorPoint(to, connection.toDirection), vector(connection.point)))
        })
    })

    it('should form one connected network without overlapping tiles', async () => {
        assert.strictEqual(connectedIds(network).size, network.tiles.length)

        const parts = await getRoadParts()
        const footprints = new Map(parts.map((part) => [part.name, part.footprint ?? { width: 1, depth: 1 }]))
        network.tiles.forEach((tile, index) => {
            const base = footprints.get(tile.name) ?? { width: 1, depth: 1 }
            const rotation = tile.rotation ?? 0
            const cosine = Math.abs(Math.cos(rotation))
            const sine = Math.abs(Math.sin(rotation))
            const footprint = {
                width: cosine * base.width + sine * base.depth,
                depth: sine * base.width + cosine * base.depth
            }

            network.tiles.slice(index + 1).forEach((otherBase) => {
                const otherFootprint = footprints.get(otherBase.name) ?? { width: 1, depth: 1 }
                const otherCosine = Math.abs(Math.cos(otherBase.rotation ?? 0))
                const otherSine = Math.abs(Math.sin(otherBase.rotation ?? 0))
                const other = {
                    width: otherCosine * otherFootprint.width + otherSine * otherFootprint.depth,
                    depth: otherSine * otherFootprint.width + otherCosine * otherFootprint.depth
                }
                const overlapsX =
                    Math.abs(tile.position.x - otherBase.position.x) < (footprint.width + other.width) / 2 - 0.000001
                const overlapsZ =
                    Math.abs(tile.position.z - otherBase.position.z) < (footprint.depth + other.depth) / 2 - 0.000001
                assert.ok(!overlapsX || !overlapsZ, `${tile.name} overlaps ${otherBase.name}`)
            })
        })
    })

    it('should be deterministic for the same grid size and seed', async () => {
        const parts = await getRoadParts()
        const first = generateRoadNetwork(parts, 9, 42)
        const second = generateRoadNetwork(parts, 9, 42)

        const signature = (result: RoadNetwork) =>
            result.tiles.map((tile) => `${tile.name}@${tile.position.x},${tile.position.z}`)
        assert.deepStrictEqual(signature(first), signature(second))
    })

    it('should derive two parallel vehicle routes', () => {
        const route = network.routes[0]
        assert.ok(route)
        assert.ok(route.length > 1)

        const centerPath = createRoadCenterPath(route)
        assert.ok(centerPath.getLength() > 0)
        assert.ok(createRoadCenterPath(route, true).getLength() > 0)

        const progress = 0.4
        const forward = getLanePosition(centerPath, progress, 0.16)
        const reverse = getLanePosition(centerPath, 1 - progress, 0.16, true)
        assert.ok(forward.tangent.dot(reverse.tangent) < -0.999)
        assert.ok(doubleEquals(forward.position.distanceTo(reverse.position), 0.32))
    })

    it('should wrap the linear showcase as a network', async () => {
        const showcase = await Road.buildShowcase()
        const wrapped = networkFromPath(showcase.getPath())
        assert.strictEqual(wrapped.tiles.length, showcase.path.length)
        assert.strictEqual(wrapped.routes.length, 1)
        assert.strictEqual(wrapped.routes[0]?.length, showcase.path.length)
    })
})
