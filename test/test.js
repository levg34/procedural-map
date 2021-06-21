const { Direction, RoadPart, Road } = require('../classes.js')
const assert = require('assert')

function buildTestData() {
    return [
        new RoadPart({
            directions: [Direction.Up,Direction.Down]
        }),
        new RoadPart({
            directions: [Direction.Up,Direction.Left]
        }),
        new RoadPart({
            directions: [Direction.Right,Direction.Down]
        })
    ]
}

const testData = buildTestData()

const road = new Road()

describe('Road parts', function() {
    describe('create road', function() {
        it('should return an array of road parts', function() {
            assert.ok(road.createRoad(testData) instanceof Array)
        })
        it('should use all road parts once', function() {
            assert.strictEqual(road.createRoad(testData).length,testData.length)
        })
        it('should connect ', function() {
            assert.strictEqual(road.createRoad(testData).length,testData.length)
        })
    })
})
