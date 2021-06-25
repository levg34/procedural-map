import { Vector3 } from "three"

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
    position: Vector3
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
        path.push(this.createLinkedRoadPart('road_straight',new Vector3(0,0,0)))
        for (let i=1;i<length;++i) {
            path.push(this.createLinkedRoadPart('road_straight',new Vector3(i,0,0)))
        }
        const crossingPosition = Math.floor(length / 2)
        path[crossingPosition] = this.createLinkedRoadPart('road_crossing',new Vector3(crossingPosition,0,0))
        return path
    }
    getRoadPartByName(name: string): RoadPart {
        return this.parts.find(part => part.name === name)
    }
    createLinkedRoadPart(name: string, position: Vector3): LinkedRoadPart {
        return {
            roadPart: this.getRoadPartByName(name),
            position
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