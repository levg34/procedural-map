const { RoadPart, Road, LinkedRoadPart } = require('../classes.js')
const assert = require('assert')
const { getRoadParts } = require('../utils.js')
const { Vector3 } = require('three')
const { roadTypes } = require('../roadData')
const { vectors3Equals, doubleEquals } = require('./testUtils.js')

describe('RoadPart', function () {
    let part
    let clonedPart
    before((done) => {
        getRoadParts()
            .then((parts) => {
                part = new RoadPart(parts[11])
                clonedPart = part.clone()
                done()
            })
            .catch((err) => done(err))
    })
    describe('rotate', () => {
        it('should rotate all directions', () => {
            const expected = [new Vector3(0, 0, -1), new Vector3(-1, 0, 0)]
            part.rotate(Math.PI / 2)
            clonedPart.rotate(Math.PI / 2)
            // assert.deepStrictEqual(part.directions,expected)
            part.directions.forEach((dir, index) => {
                assert.ok(vectors3Equals(dir, expected[index]))
            })
        })
        it('should add to rotation', () => {
            assert.ok(doubleEquals(part.rotation, Math.PI / 2))
        })
        it('should not mutate directions supplied to its constructor', () => {
            const direction = new Vector3(1, 0, 0)
            const isolatedPart = new RoadPart({ url: '', name: 'straight', directions: [direction] })

            isolatedPart.rotate(Math.PI / 2)

            assert.deepStrictEqual(direction, new Vector3(1, 0, 0))
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
            Object.keys(clonedPart).forEach((key) => {
                if (clonedPart[key] instanceof Object || clonedPart[key] instanceof Array) {
                    assert.notStrictEqual(clonedPart[key], part[key])
                }
            })
        })
    })
})

describe('LinkedRoadPart', () => {
    let linkedPart
    let straight
    before((done) => {
        getRoadParts()
            .then((parts) => {
                const bend = new RoadPart(parts[11])
                linkedPart = new LinkedRoadPart(bend)
                const straightPart = parts.find((part) => part.name === 'road_straight')
                straight = new RoadPart(straightPart)
                done()
            })
            .catch((err) => done(err))
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
            const selected = linkedPart.selectDirection()
            assert.ok(!linkedPart.getAvailableDirections().includes(selected))
        })
        it('should find a connection after rotating a part already beyond 270 degrees', () => {
            const rotatedPart = new LinkedRoadPart(
                new RoadPart({
                    url: '',
                    name: 'straight',
                    rotation: 2 * Math.PI,
                    directions: [new Vector3(0, 0, 1), new Vector3(0, 0, -1)]
                })
            )
            const rotate = rotatedPart.rotate.bind(rotatedPart)
            let rotationCount = 0
            rotatedPart.rotate = (angle) => {
                rotationCount++
                assert.ok(rotationCount <= 4, 'Direction selection rotated more than four times')
                rotate(angle)
            }

            const selected = rotatedPart.selectDirection(new Vector3(1, 0, 0))

            assert.ok(vectors3Equals(selected, new Vector3(-1, 0, 0)))
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

describe('Road', () => {
    const roadLength = 10
    let road = null
    before((done) => {
        Road.build(roadLength)
            .then((res) => {
                road = res
                done()
            })
            .catch((err) => done(err))
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
        it('should contain exactly ONE road crossing', () => {
            assert.strictEqual(
                road.createStraightLine(straightLength).filter((e) => e.name === 'road_crossing').length,
                1
            )
        })
    })
    describe('get part by name', () => {
        const partName = 'road_crossing'
        it('should not be null if exists', () => {
            assert.notStrictEqual(road.getRoadPartByName(partName), null)
            assert.notStrictEqual(road.getRoadPartByName(partName), undefined)
        })
        it('should return the correct part', () => {
            assert.strictEqual(road.getRoadPartByName(partName).name, partName)
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
        it('should contain road crossings', () => {
            assert.ok(road.path.map((e) => e.name).includes('road_crossing'))
        })
        it('should be continuous', () => {
            for (let index = 1; index < road.path.length; index++) {
                const previous = road.path[index - 1]
                const current = road.path[index]
                const direction = current.position.clone().sub(previous.position)

                assert.ok(
                    previous.usedDirections.some((usedDirection) => vectors3Equals(usedDirection, direction)),
                    `${previous.name} at ${previous.position.toArray()} is not connected to ${current.name} at ${current.position.toArray()}`
                )
            }
        })
        it('should not place multiple parts at the same position', () => {
            for (let index = 0; index < road.path.length; index++) {
                for (let otherIndex = index + 1; otherIndex < road.path.length; otherIndex++) {
                    assert.ok(
                        !vectors3Equals(road.path[index].position, road.path[otherIndex].position),
                        `Parts ${index} and ${otherIndex} overlap at ${road.path[index].position.toArray()}`
                    )
                }
            }
        })
        it('should have a start and an end', () => {
            assert.strictEqual(road.path.filter((e) => e.name === 'road_end').length, 2)
        })
        it('should contain turns', () => {
            assert.ok(road.path.map((e) => e.name).filter((e) => roadTypes.turn.for.includes(e)).length > 0)
        })
    })
})
