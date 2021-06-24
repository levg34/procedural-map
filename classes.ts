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
        this.path = this.createStraightLine(length)
    }
    createStraightLine(length: number) {
        const path = []
        if (length < 2) return path
        path.push(this.createLinkedRoadPart('road_straight',null,'+x'))
        for (let i=1;i<length;++i) {
            path.push(this.createLinkedRoadPart('road_straight','-x','+x'))
        }
        delete path[length-1].linkNext
        path[Math.floor(length/2)] = this.createLinkedRoadPart('road_crossing','-x','+x')
        return path
    }
    createLinkedRoadPart(name: string, previous?: Direction, next?: Direction): LinkedRoadPart {
        return {
            roadPart: this.parts.find(part => part.name === name),
            linkNext: next,
            linkPrevious: previous
        }
    }
    getPath() {
        return this.path
    }
}

module.exports = {
    RoadPart,
    Road
}