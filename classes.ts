const { getRoadParts } = require('./utils')

type Direction = '+x' | '-x' | '+y' | '-y' 

class RoadPart {
    url: string
    name: string
    directions: Direction[]

    constructor(parameters: RoadPart) {
        if (!parameters) return
        this.directions = parameters.directions instanceof Array ? parameters.directions : []
        this.url = parameters.url
        this.name = parameters.name
    }
}

interface LinkedRoadPart {
    roadPart: RoadPart,
    linkNext?: Direction
    linkPrevious?: Direction
}

class Road {
    parts: RoadPart[]
    path: LinkedRoadPart[]
    constructor(length: number) {
        this.parts = []
        this.path = []
        getRoadParts().then((parts: RoadPart[]) => {
            this.parts = parts
            this.createPath(length)
        }).catch((err: string) => console.log(err))
    }
    createPath(length: number) {
        const path = []
        path.push({
            roadPart: this.parts.find(part => part.name === 'road_straight'),
            linkNext: '+x'
        })
        for (let i=1;i<length;++i) {
            path.push({
                roadPart: this.parts.find(part => part.name === 'road_straight'),
                linkNext: '+x',
                linkPrevious: '-x'
            })
        }
        delete path[length-1].linkNext
        this.path = path
    }
    getPath() {
        return this.path
    }
}

module.exports = {
    RoadPart,
    Road
}