const { Direction, RoadPart, Road } = require('../classes.js')
const assert = require('assert')

const roadLength = 5
const road = new Road(roadLength)

describe('Road parts', function() {
    describe('create road', function() {
        it('should return an array of road parts', function() {
            assert.ok(road.path instanceof Array)
        })
        it('should be exactly as long as intended', function() {
            assert.strictEqual(road.path.length,roadLength)
        })
        it('should create a straight path')
        it('should connect two points')
    })
})
