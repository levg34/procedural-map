import assert from 'node:assert/strict'
import { CurvePath, Vector3 } from 'three'
import { beforeAll, describe, it } from 'vitest'
import { LinkedRoadPart, Road } from '../src/server/roadBuilder'
import { roadTypes, roadVariantGroups } from '../src/data/road'
import { createRoadCenterPath, getLanePosition, getTurnaroundPose } from '../src/client/vehiclePath'
import { getRoadParts } from '../src/server/utils'
import { doubleEquals, vectors3Equals } from './testUtils'

function roadSignature(road: Road): string {
    return road.path
        .map((part) =>
            [
                part.name,
                part.position.toArray().join(','),
                part.rotation ?? 0,
                part.usedDirections.map((direction) => direction.toArray().join(',')).join(';')
            ].join('|')
        )
        .join('/')
}

function assertPartsConnected(parts: LinkedRoadPart[]): void {
    for (let index = 1; index < parts.length; index++) {
        const previous = parts[index - 1]
        const current = parts[index]
        assert.ok(previous && current)
        assert.ok(
            previous.usedDirections.some((previousDirection) =>
                current.usedDirections.some(
                    (currentDirection) =>
                        vectors3Equals(previousDirection.clone().add(currentDirection), new Vector3()) &&
                        vectors3Equals(
                            previous.position.clone().add(previous.getConnectionOffset(previousDirection)),
                            current.position.clone().add(current.getConnectionOffset(currentDirection))
                        )
                )
            ),
            `${previous.name} at ${previous.position.toArray()} is not connected to ${current.name} at ${current.position.toArray()}`
        )
    }
}

function assertNoOverlappingParts(parts: LinkedRoadPart[]): void {
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index]
        assert.ok(part)
        const footprint = part.getFootprint()

        for (let otherIndex = index + 1; otherIndex < parts.length; otherIndex++) {
            const other = parts[otherIndex]
            assert.ok(other)
            const otherFootprint = other.getFootprint()
            const overlapsX =
                Math.abs(part.position.x - other.position.x) < (footprint.width + otherFootprint.width) / 2 - 0.000001
            const overlapsZ =
                Math.abs(part.position.z - other.position.z) < (footprint.depth + otherFootprint.depth) / 2 - 0.000001

            assert.ok(
                !overlapsX || !overlapsZ,
                `Parts ${part.name} and ${other.name} overlap at ${part.position.toArray()} and ${other.position.toArray()}`
            )
        }
    }
}

describe('Road', () => {
    const roadLength = 10
    let road: Road
    beforeAll(async () => {
        road = await Road.build(roadLength)
    })
    describe('create straight line', function () {
        const straightLength = 5
        it('should return an array of road parts', function () {
            assert.ok(road.createStraightLine(straightLength) instanceof Array)
        })
        it('should return an empty array if length insufficient', function () {
            assert.ok(road.createStraightLine(1) instanceof Array)
        })
        it('should be exactly as long as intended', function () {
            assert.strictEqual(road.createStraightLine(straightLength).length, straightLength)
        })
        it('should contain exactly ONE intersection piece', () => {
            const intersectionNames = new Set<string>(roadVariantGroups.intersection)
            assert.strictEqual(
                road.createStraightLine(straightLength).filter((part) => intersectionNames.has(part.name)).length,
                1
            )
        })
    })

    describe('Road showcase', () => {
        it('should include every configured connectable road part exactly once', async () => {
            const road = await Road.buildShowcase()
            const availableNames = (await getRoadParts())
                .filter((part) => part.directions !== undefined)
                .map((part) => part.name)
            const expectedNames = Object.values(roadTypes)
                .filter((type) => type.directions.length !== 1)
                .flatMap((type) => type.for)
                .filter((name) => availableNames.includes(name))
            const actualNames = road.path.map((part) => part.name)

            assert.deepStrictEqual(
                actualNames.filter((name) => expectedNames.includes(name)).sort(),
                [...expectedNames].sort()
            )
            expectedNames.forEach((name) => {
                assert.strictEqual(actualNames.filter((actualName) => actualName === name).length, 1)
            })
        })

        it('should place the wide side-road between its width-transition pieces', async () => {
            const road = await Road.buildShowcase()
            const names = road.path.map((part) => part.name)
            const entryIndex = names.indexOf('road_sideEntry')

            assert.deepStrictEqual(names.slice(entryIndex, entryIndex + 3), [
                'road_sideEntry',
                'road_side',
                'road_sideExit'
            ])
        })

        it('should create two parallel vehicle lanes following the road route', async () => {
            const road = await Road.buildShowcase()
            const centerPath = createRoadCenterPath(road.path)
            const progress = 0.4
            const forward = getLanePosition(centerPath, progress, 0.16)
            const reverse = getLanePosition(centerPath, 1 - progress, 0.16, true)
            const midpoint = centerPath.getPointAt(progress)
            const laneDistance = forward.position.distanceTo(reverse.position)

            assert.ok(forward.tangent.dot(reverse.tangent) < -0.999)
            assert.ok(doubleEquals(laneDistance, 0.32))
            assert.ok(doubleEquals(forward.position.distanceTo(midpoint), 0.16))
            assert.ok(doubleEquals(reverse.position.distanceTo(midpoint), 0.16))
        })

        it('should route reverse traffic around the roundabout in the same direction', async () => {
            const road = await Road.buildShowcase()
            const forwardPath = createRoadCenterPath(road.path)
            const reversePath = createRoadCenterPath(road.path, true)
            const roundabout = road.path.find((part) => part.name === 'road_roundabout')
            const roundaboutPath = reversePath.curves.find((curve) => curve instanceof CurvePath)

            assert.ok(reversePath.getLength() > forwardPath.getLength() + 2)
            assert.ok(roundabout)
            assert.ok(roundaboutPath instanceof CurvePath)

            const lanePosition = getLanePosition(roundaboutPath, 0.5, 0.16).position
            assert.ok(doubleEquals(lanePosition.distanceTo(roundabout.position), 0.8))
        })

        it('should be continuous and avoid overlapping parts', async () => {
            const road = await Road.buildShowcase()
            const connectedRoad = road.path.filter((part) => part.directions.length > 0)

            assertPartsConnected(connectedRoad)
            assertNoOverlappingParts(road.path)

            const noEntry = road.path.find((part) => part.name === 'road_square')
            assert.ok(noEntry)
            assert.ok(
                connectedRoad.some((part) =>
                    part.getAvailableDirections().some((direction) =>
                        vectors3Equals(
                            part.position
                                .clone()
                                .add(part.getConnectionOffset(direction))
                                .add(direction.clone().multiplyScalar(noEntry.getHalfExtentAlong(direction))),
                            noEntry.position
                        )
                    )
                ),
                'No-entry tile should occupy an unused intersection branch'
            )
        })
        it('should not add decorations in showcase', async () => {
            const road = await Road.buildShowcase()
            assert.deepStrictEqual(road.decorations, [])
        })
    })
    describe('get part by name', () => {
        const partName = 'road_crossing'
        it('should not be null if exists', () => {
            assert.notStrictEqual(road.getRoadPartByName(partName), null)
            assert.notStrictEqual(road.getRoadPartByName(partName), undefined)
        })
        it('should return the correct part', () => {
            const part = road.getRoadPartByName(partName)
            assert.ok(part)
            assert.strictEqual(part.name, partName)
        })
    })
    describe('create road', function () {
        it('should return an array of road parts', function () {
            assert.ok(road.path instanceof Array)
        })
        it('should be exactly as long as intended', function () {
            const straightSections = 6
            const turns = 5
            const endpoints = 2
            assert.strictEqual(road.path.length, straightSections * roadLength + turns + endpoints)
        })
        it('should create a vehicle route for the generated road', () => {
            assert.ok(createRoadCenterPath(road.path).getLength() > 0)
            assert.ok(createRoadCenterPath(road.path, true).getLength() > 0)
        })
        it('should keep a continuous tangent through both road ends', () => {
            for (const reverse of [false, true]) {
                const path = createRoadCenterPath(road.path, reverse)
                const start = getLanePosition(path, 0, 0.16)
                const afterStart = getLanePosition(path, 0.01, 0.16)
                const beforeEnd = getLanePosition(path, 0.99, 0.16)
                const end = getLanePosition(path, 1, 0.16)

                assert.ok(start.tangent.dot(afterStart.tangent) > 0.999999)
                assert.ok(beforeEnd.tangent.dot(end.tangent) > 0.999999)
            }
        })
        it('should turn between opposite lanes at the road end', () => {
            const forwardPath = createRoadCenterPath(road.path)
            const reversePath = createRoadCenterPath(road.path, true)
            const laneOffset = 0.16

            const turnStart = getTurnaroundPose(forwardPath, 0, laneOffset)
            const turnEnd = getTurnaroundPose(forwardPath, 1, laneOffset)
            const forwardLane = getLanePosition(forwardPath, 1, laneOffset)
            const reverseLane = getLanePosition(reversePath, 0, laneOffset)

            assert.ok(turnStart.position.distanceTo(forwardLane.position) < 0.000001)
            assert.ok(turnEnd.position.distanceTo(reverseLane.position) < 0.000001)
            assert.ok(turnStart.tangent.dot(forwardLane.tangent) > 0.999999)
            assert.ok(turnEnd.tangent.dot(reverseLane.tangent) > 0.999999)
        })
        it('should contain an intersection piece', () => {
            const intersectionNames = new Set<string>(roadVariantGroups.intersection)
            assert.ok(road.path.some((part) => intersectionNames.has(part.name)))
        })
        it('should contain a roundabout', () => {
            assert.strictEqual(road.path.filter((part) => part.name === 'road_roundabout').length, 1)
        })
        it('should be continuous and avoid overlapping parts', () => {
            assertPartsConnected(road.path.filter((part) => part.usedDirections.length > 0))
            assertNoOverlappingParts(road.path)
        })
        it('should have a start and an end', () => {
            assert.strictEqual(road.path.filter((e) => e.name === 'road_end').length, 2)
        })
        it('should contain turns', () => {
            assert.ok(road.path.map((e) => e.name).filter((e) => roadTypes.turn.for.includes(e)).length > 0)
        })
        it('should include decoration caps for free connectors (normal road)', () => {
            assert.ok(Array.isArray(road.decorations))
            const allowed = new Set(['construction_barrier', 'construction_pylon', 'construction_light'])
            for (const deco of road.decorations) {
                assert.ok(allowed.has(deco.name), `unexpected decoration name: ${deco.name}`)
                assert.equal(typeof deco.position.x, 'number')
                assert.equal(typeof deco.position.y, 'number')
                assert.equal(typeof deco.position.z, 'number')
            }
        })
    })
    describe('seeded road variants', () => {
        it('should produce identical roads for the same seed', async () => {
            const first = await Road.build(roadLength, 42)
            const second = await Road.build(roadLength, 42)

            assert.strictEqual(roadSignature(first), roadSignature(second))
        })
        it('should produce different roads for different seeds', async () => {
            const first = await Road.build(roadLength, 1)
            const second = await Road.build(roadLength, 2)

            assert.notStrictEqual(roadSignature(first), roadSignature(second))
        })
        it('should keep generated roads connected and routable across many seeds', async () => {
            for (let seed = 0; seed < 30; seed++) {
                const road = await Road.build(roadLength, seed)

                assertPartsConnected(road.path.filter((part) => part.usedDirections.length > 0))
                assertNoOverlappingParts(road.path)
                assert.strictEqual(road.path.filter((part) => part.name === 'road_roundabout').length, 1)
                assert.ok(createRoadCenterPath(road.path).getLength() > 0)
                assert.ok(createRoadCenterPath(road.path, true).getLength() > 0)
                assert.ok(Array.isArray(road.decorations))
            }
        })
    })
})
