const { Direction, RoadPart, Road } = require('../classes.js')
const assert = require('assert')

const roadLength = 5
const road = new Road(roadLength)

describe('Road parts', function() {
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
            assert.strictEqual(road.createStraightLine(straightLength).filter(e => e.roadPart.name === 'road_crossing').length, 1)
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
            assert.ok(road.path.map(e => e.roadPart.name).includes('road_crossing'))
        })
        it('should have a start and an end')
        it('should contain turns')
    })
})
