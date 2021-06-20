const { Direction, RoadPart } = require('../classes.js')
const assert = require('assert')
const { createRoad } = require('../index.js')

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

describe('Road parts', function() {
    describe('create road', function() {
        it('should return an array of road parts', function() {
            assert.ok(createRoad(testData) instanceof Array)
        })
        it('should use all road parts once', function() {
            assert.strictEqual(createRoad(testData).length,testData.length)
        })
        it('should connect ', function() {
            assert.strictEqual(createRoad(testData).length,testData.length)
        })
    })
})
