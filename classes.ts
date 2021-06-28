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
        this.parts = parts.map((part: RoadPart) => new RoadPart(part))
        this.path = []
        this.createPath(length)
    }
    createPath(length: number) {
        this.connectAll(this.createStraightLine(length))
    }
    connectAll(parts: RoadPart[]) {
        parts.forEach(part => this.connect(part))
    }
    connect(part: RoadPart) {
        const position = new Vector3()
        if (this.path.length > 0) {
            const {x,y,z} = this.calculateNext(part)
            position.set(x,y,z)
        }
        this.path.push(new LinkedRoadPart(part, position))
    }
    calculateNext(part: RoadPart): Vector3 {
        const next = new Vector3()
        if (this.path.length > 0) {
            const previous = [...this.path].pop()
            next.add(previous.position)
            next.add(part.directions[0])
        }
        return next
    }
    createStraightLine(length: number): RoadPart[] {
        const path = []
        if (length < 2) return path

        const straight = this.getRoadPartByName('road_straight')
        const end = this.getRoadPartByName('road_end')
        const crossing = this.getRoadPartByName('road_crossing')
        const crossingPosition = Math.floor(length / 2)

        for (let i=0;i<length;++i) {
            if (i === crossingPosition) {
                path.push(crossing)
            } else {
                path.push(straight)
            }
        }

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