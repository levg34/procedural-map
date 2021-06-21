const { Direction, RoadPart, Road } = require('../classes.js')
const assert = require('assert')

const road = new Road()

describe('Road parts', function() {
    describe('create road', function() {
        it('should return an array of road parts', function() {
            assert.ok(road.path instanceof Array)
        })
        it('should use all road parts once', function() {
            assert.strictEqual(road.path.length,road.parts.length)
        })
        it('should create a straight path')
        it('should connect two points')
    })
})
