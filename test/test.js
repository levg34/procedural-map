const { RoadPart, Road, LinkedRoadPart } = require('../classes.js')
const assert = require('assert')
const { getRoadParts } = require('../utils.js')
const { Vector3 } = require('three')
const { roadTypes } = require('../roadData')
const { vectors3Equals, doubleEquals } = require('./testUtils.js')

describe('RoadPart', function() {
    let part
    let clonedPart
    before(done => {
        getRoadParts().then(parts => {
            part = new RoadPart(parts[11])
            clonedPart = part.clone()
            done()
        }).catch(err => done(err))
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
            Object.keys(clonedPart).forEach(key => {
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
    before(done => {
        getRoadParts().then(parts => {
            const bend = new RoadPart(parts[11])
            linkedPart = new LinkedRoadPart(bend)
            const straightPart = parts.find(part => part.name === 'road_straight')
            straight = new RoadPart(straightPart)
            done()
        }).catch(err => done(err))
    })
    describe('rotate', () => {
        it('should rotate all directions', () => {
            const expected = [
                new Vector3(0,0,-1),
                new Vector3(-1,0,0)
            ]
            linkedPart.rotate(Math.PI/2)
            // assert.deepStrictEqual(part.directions,expected)
            linkedPart.directions.forEach((dir, index) => {
                assert.ok(vectors3Equals(dir, expected[index]))
            })
        })
        it('should add to rotation', () => {
            assert.ok(doubleEquals(linkedPart.rotation, Math.PI/2))
        })
    })
    describe('translate', () => {
        it('should translate the position', () => {
            const expected = new Vector3(1,-2,3)
            linkedPart.translate(expected)
            assert.deepStrictEqual(linkedPart.position,expected)
        })
        it('should translate the position multiple times', () => {
            const expected = new Vector3(3,0,5)
            linkedPart.translate(new Vector3(2,2,2))
            assert.deepStrictEqual(linkedPart.position,expected)
        })
    })
    describe('getAvailableDirections',() => {
        it('should return all directions when none is used', () => {
            assert.deepStrictEqual(linkedPart.getAvailableDirections(), linkedPart.directions)
        })
        it('should not return a direction which is being used', () => {
            const selected = linkedPart.selectDirection()
            assert.ok(!linkedPart.getAvailableDirections().includes(selected))
        })
    })
    describe('connect', () => {
        xit ('should connect parts by their available directions', () => {
            const connected = linkedPart.connect(straight)
            linkedPart
        })
        xit ('should not use a direction that is already being used', () => {
            //
        })
    })
})

describe('Road', () => {
    const roadLength = 10
    let road = null
    before(done => {
        Road.build(roadLength).then(res => {
            road = res
            done()
        }).catch(err => done(err))
    })
    describe('create straight line', function() {
        const straightLength = 5
        it('should return an array of road parts', function() {
            assert.ok(road.createStraightLine(straightLength) instanceof Array)
        })
        it('should return an empty array if length insufficient', function() {
            assert.ok(road.createStraightLine(1) instanceof Array)
        })
        it('should be exactly as long as intended', function() {
            assert.strictEqual(road.createStraightLine(straightLength).length,straightLength)
        })
        it('should contain exactly ONE road crossing', () => {
            assert.strictEqual(road.createStraightLine(straightLength).filter(e => e.name === 'road_crossing').length, 1)
        })
    })
    describe('get part by name', () => {
        const partName = 'road_crossing'
        it ('should not be null if exists',() => {
            assert.notStrictEqual(road.getRoadPartByName(partName),null)
            assert.notStrictEqual(road.getRoadPartByName(partName),undefined)
        })
        it('should return the correct part', () => {
            assert.strictEqual(road.getRoadPartByName(partName).name, partName)
        })
    })
    describe('create road', function() {
        it('should return an array of road parts', function() {
            assert.ok(road.path instanceof Array)
        })
        it('should be exactly as long as intended', function() {
            assert.strictEqual(road.path.length,roadLength)
        })
        it('should contain road crossings', () => {
            assert.ok(road.path.map(e => e.name).includes('road_crossing'))
        })
        xit('should be continuous', () => {
            assert.strictEqual(road.path[roadLength-1].position.x - road.path[0].position.x, roadLength-1)
        })
        it('should have a start and an end', () => {
            assert.strictEqual(road.path.filter(e => e.name === 'road_end').length,2)
        })
        it('should contain turns', () => {
            assert.ok(road.path.map(e => e.name).filter(e => roadTypes.turn.for.includes(e)).length > 0)
        })
    })
})
