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

    constructor(parameters) {
        if (!parameters) return
        this.directions = parameters.directions instanceof Array ? parameters.directions : []
        this.model = parameters.model
    }
}

module.exports = {
    Direction,
    RoadPart
}