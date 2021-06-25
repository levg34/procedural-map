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
    static build(length: number): Promise<Road> {
        return new Promise((resolve,reject) => {
            getRoadParts().then((parts: RoadPart[]) => {
                resolve(new Road(parts,length))
            }).catch((err: string) => reject(err))
        })
    }
    constructor(parts: RoadPart[], length: number) {
        this.parts = parts
        this.path = []
        this.createPath(length)
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
    getRoadPartByName(name: string): RoadPart {
        return this.parts.find(part => part.name === name)
    }
    createLinkedRoadPart(name: string, previous?: Direction, next?: Direction): LinkedRoadPart {
        return {
            roadPart: this.getRoadPartByName(name),
            linkNext: next,
            linkPrevious: previous
        }
    }
    rotateRoadPart(part: RoadPart): RoadPart {
        return part
    }
    getPath() {
        return this.path
    }
}

module.exports = {
    RoadPart,
    Road
}