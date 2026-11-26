import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { beforeAll, describe, it, vi } from 'vitest'
import { LinkedRoadPart, RoadPart } from '../src/server/classes'
import { getRoadParts } from '../src/server/utils'
import { doubleEquals, vectors3Equals } from './testUtils'

describe('RoadPart', function () {
    let part: RoadPart
    let clonedPart: RoadPart
    beforeAll(async () => {
        const parts = await getRoadParts()
        const partData = parts[11]
        if (!partData) throw new Error('Required test road part is missing')

        part = new RoadPart(partData)
        clonedPart = part.clone()
    })
    it('should include measured footprints and off-center connector locations', async () => {
        const parts = await getRoadParts()
        const partsByName = new Map(parts.map((part) => [part.name, part]))

        assert.deepStrictEqual(partsByName.get('road_curve')?.footprint, { width: 2, depth: 2 })
        assert.deepStrictEqual(partsByName.get('road_roundabout')?.footprint, { width: 3, depth: 3 })
        assert.deepStrictEqual(partsByName.get('road_split')?.footprint, { width: 1, depth: 2 })
        assert.deepStrictEqual(partsByName.get('road_curve')?.connectionOffsets, [
            new Vector3(1, 0, 0.5),
            new Vector3(-0.5, 0, -1)
        ])
        assert.deepStrictEqual(partsByName.get('road_curveIntersection')?.connectionOffsets, [
            new Vector3(1, 0, 0.5),
            new Vector3(-1, 0, 0.5),
            new Vector3(-0.5, 0, -1)
        ])
        for (const name of ['road_side', 'road_sideEntry', 'road_sideExit']) {
            assert.deepStrictEqual(partsByName.get(name)?.connectionOffsets, [
                new Vector3(0.5, 0, -0.155),
                new Vector3(-0.5, 0, -0.155)
            ])
        }
    })
    describe('rotate', () => {
        it('should rotate all directions', () => {
            const expected = [new Vector3(0, 0, -1), new Vector3(-1, 0, 0)]
            part.rotate(Math.PI / 2)
            clonedPart.rotate(Math.PI / 2)
            // assert.deepStrictEqual(part.directions,expected)
            part.directions.forEach((dir, index) => {
                const expectedDirection = expected[index]
                assert.ok(expectedDirection && vectors3Equals(dir, expectedDirection))
            })
        })
        it('should add to rotation', () => {
            assert.ok(part.rotation !== undefined && doubleEquals(part.rotation, Math.PI / 2))
        })
        it('should not mutate directions supplied to its constructor', () => {
            const direction = new Vector3(1, 0, 0)
            const isolatedPart = new RoadPart({ url: '', name: 'straight', directions: [direction] })

            isolatedPart.rotate(Math.PI / 2)

            assert.deepStrictEqual(direction, new Vector3(1, 0, 0))
        })
        it('should rotate its footprint with the part', () => {
            const part = new RoadPart({
                url: '',
                name: 'split',
                directions: [],
                footprint: { width: 1, depth: 2 }
            })

            part.rotate(Math.PI / 2)

            assert.ok(doubleEquals(part.getFootprint().width, 2))
            assert.ok(doubleEquals(part.getFootprint().depth, 1))
        })
    })
    describe('clone', () => {
        it('should return an instance of RoadPart', () => {
            assert.ok(clonedPart instanceof RoadPart)
        })
        it('should have the same properties as the original', () => {
            assert.deepStrictEqual(clonedPart, part)
        })
        it('should not share a reference with the original', () => {
            assert.notStrictEqual(clonedPart, part)
        })
        it('should not share deep references with the original', () => {
            assert.notStrictEqual(clonedPart.directions, part.directions)
            clonedPart.directions.forEach((direction, index) => {
                const originalDirection = part.directions[index]
                assert.ok(originalDirection)
                assert.notStrictEqual(direction, originalDirection)
            })
        })
    })
})

describe('LinkedRoadPart', () => {
    let linkedPart: LinkedRoadPart
    let straight: RoadPart
    beforeAll(async () => {
        const parts = await getRoadParts()
        const bendData = parts[11]
        const straightData = parts.find((part) => part.name === 'road_straight')
        if (!bendData || !straightData) throw new Error('Required test road parts are missing')

        const bend = new RoadPart(bendData)
        linkedPart = new LinkedRoadPart(bend)
        straight = new RoadPart(straightData)
    })
    describe('translate', () => {
        it('should translate the position', () => {
            const expected = new Vector3(1, -2, 3)
            linkedPart.translate(expected)
            assert.deepStrictEqual(linkedPart.position, expected)
        })
        it('should translate the position multiple times', () => {
            const expected = new Vector3(3, 0, 5)
            linkedPart.translate(new Vector3(2, 2, 2))
            assert.deepStrictEqual(linkedPart.position, expected)
        })
    })
    describe('getAvailableDirections', () => {
        it('should return all directions when none is used', () => {
            assert.deepStrictEqual(linkedPart.getAvailableDirections(), linkedPart.directions)
        })
        it('should not return a direction which is being used', () => {
            const connected = linkedPart.connect(straight)
            assert.strictEqual(connected.getAvailableDirections().length, straight.directions.length - 1)
        })
        it('should find a connection after rotating a part already beyond 270 degrees', () => {
            const source = new LinkedRoadPart(
                new RoadPart({
                    url: '',
                    name: 'straight',
                    directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]
                })
            )
            const rotatedPart = new RoadPart({
                url: '',
                name: 'straight',
                rotation: 2 * Math.PI,
                directions: [new Vector3(0, 0, 1), new Vector3(0, 0, -1)]
            })
            const originalRotate = RoadPart.prototype.rotate
            let rotationCount = 0
            const rotateSpy = vi.spyOn(RoadPart.prototype, 'rotate').mockImplementation(function (
                this: RoadPart,
                angle: number
            ) {
                rotationCount++
                assert.ok(rotationCount <= 4, 'Direction selection rotated more than four times')
                originalRotate.call(this, angle)
            })

            try {
                const connected = source.connect(rotatedPart)

                assert.ok(vectors3Equals(connected.usedDirections[0], new Vector3(-1, 0, 0)))
                assert.strictEqual(rotationCount, 1)
            } finally {
                rotateSpy.mockRestore()
            }
        })
    })
    describe('connect', () => {
        it('should connect parts by their available directions', () => {
            const source = new LinkedRoadPart(
                new RoadPart({
                    url: '',
                    name: 'bend',
                    directions: [new Vector3(1, 0, 0), new Vector3(0, 0, -1)]
                })
            )
            const nextPart = new RoadPart({
                url: '',
                name: 'straight',
                directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]
            })

            const connected = source.connect(nextPart)

            assert.ok(vectors3Equals(connected.position, new Vector3(1, 0, 0)))
            assert.ok(vectors3Equals(source.usedDirections[0], new Vector3(1, 0, 0)))
            assert.ok(vectors3Equals(connected.usedDirections[0], new Vector3(-1, 0, 0)))
            assert.deepStrictEqual(connected.getAvailableDirections(), [new Vector3(1, 0, 0)])
            assert.deepStrictEqual(nextPart.directions, [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)])
        })

        it('should place larger parts by their connection edges', () => {
            const source = new LinkedRoadPart(
                new RoadPart({
                    url: '',
                    name: 'roundabout',
                    directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)],
                    footprint: { width: 3, depth: 3 }
                })
            )
            const target = new RoadPart({
                url: '',
                name: 'straight',
                directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]
            })

            const connected = source.connect(target)

            assert.ok(vectors3Equals(connected.position, new Vector3(2, 0, 0)))
        })

        it('should align off-center connectors', () => {
            const curve = new RoadPart({
                url: '',
                name: 'curve',
                directions: [new Vector3(1, 0, 0), new Vector3(0, 0, -1)],
                footprint: { width: 2, depth: 2 },
                connectionOffsets: [new Vector3(1, 0, 0.5), new Vector3(-0.5, 0, -1)]
            })
            const source = new LinkedRoadPart(curve)
            const straightPart = new RoadPart({
                url: '',
                name: 'straight',
                directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]
            })

            const connected = source.connect(straightPart)

            assert.ok(vectors3Equals(connected.position, new Vector3(1.5, 0, 0.5)))
        })

        it('should not use a direction that is already being used', () => {
            const source = new LinkedRoadPart(
                new RoadPart({
                    url: '',
                    name: 'bend',
                    directions: [new Vector3(1, 0, 0), new Vector3(0, 0, -1)]
                })
            )
            const straightPart = new RoadPart({
                url: '',
                name: 'straight',
                directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]
            })

            source.connect(straightPart)
            source.connect(straightPart)

            assert.strictEqual(source.getAvailableDirections().length, 0)
            assert.throws(() => source.connect(straightPart), /No direction available/)
        })
    })
})
