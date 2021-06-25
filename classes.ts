import { Vector3 } from "three"

const { getRoadParts } = require('./utils')

class RoadPart {
    url: string
    name: string
    directions: Vector3[]

    constructor(parameters: RoadPart) {
        if (!parameters) return
        this.directions = parameters.directions instanceof Array ? parameters.directions : []
        this.url = parameters.url
        this.name = parameters.name
    }

    rotate(angle: number) {
        this.directions = this.directions.map((direction: Vector3) => direction.applyAxisAngle(new Vector3(0,1,0),angle))
    }
}

class LinkedRoadPart {
    roadPart: RoadPart
    position: Vector3
    rotation?: number

    constructor(roadPart: RoadPart, position: Vector3, rotation?: number) {
        this.roadPart = roadPart
        this.position = position
        if (rotation || rotation === 0) {
            this.rotation = this.rotation
        }
    }

    static fromObject(object: LinkedRoadPart): LinkedRoadPart {
        if (!object) return null
        const {roadPart, position, rotation} = object
        return new LinkedRoadPart(roadPart, position, rotation)
    }
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

        const straight = this.getRoadPartByName('road_straight')
        const end = this.getRoadPartByName('road_end')
        const crossing = this.getRoadPartByName('road_crossing')

        path.push(new LinkedRoadPart(straight,new Vector3(0,0,0)))
        for (let i=1;i<length;++i) {
            path.push(new LinkedRoadPart(straight,new Vector3(i,0,0)))
        }
        const crossingPosition = Math.floor(length / 2)
        path[crossingPosition] = new LinkedRoadPart(crossing,new Vector3(crossingPosition,0,0))

        return path
    }
    getRoadPartByName(name: string): RoadPart {
        return this.parts.find(part => part.name === name)
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