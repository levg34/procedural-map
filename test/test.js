const { Direction, RoadPart, Road } = require('../classes.js')
const assert = require('assert')

describe('Road parts', function() {
    const roadLength = 5
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
            assert.strictEqual(road.createStraightLine(straightLength).filter(e => e.roadPart.name === 'road_crossing').length, 1)
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
    describe('rotate part', () => {
        const partName = 'road_crossing'
        let roadPart
        before(() => {
            roadPart = road.getRoadPartByName(partName)
        })
        it('should return the same part', () => {
            assert.strictEqual(road.rotateRoadPart(roadPart).name,partName)
        })
        it('should rotate the connectors')
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
