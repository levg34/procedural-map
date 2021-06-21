const { getRoadParts } = require('./utils')

interface Model {
    url: string,
    name: string
}

type Direction = '+x' | '-x' | '+y' | '-y' 

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
    path: RoadPart[]
    constructor() {
        this.parts = []
        this.path = []
        getRoadParts().then((parts: Model[]) => {
            this.parts = parts.map((part: Model) => new RoadPart({
                model: part,
                directions: []
            }))
            this.createPath()
        }).catch((err: string) => console.log(err))
    }
    createPath() {
        this.path = this.parts
    }
}

module.exports = {
    RoadPart,
    Road
}