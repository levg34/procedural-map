interface Model {
    url: string
    model?: object
}

enum Direction {
    Up,
    Down,
    Left,
    Right,
}

class RoadPart {
    model: Model
    directions: Direction[]

    constructor(parameters: RoadPart) {
        if (!parameters) return
        this.directions = parameters.directions instanceof Array ? parameters.directions : []
        this.model = parameters.model
    }
}

class Road {
    parts: RoadPart[]
    createRoad(roadParts: RoadPart[]) {
        this.parts = roadParts
        return roadParts
    }
}

module.exports = {
    Direction,
    RoadPart,
    Road
}