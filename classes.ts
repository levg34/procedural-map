import { Vector3 } from "three"

const { getRoadParts } = require('./utils')

type RoadPartType = {
    url: string
    name: string
    directions?: Vector3[]
}

class RoadPart {
    url: string
    name: string
    directions: Vector3[]

    constructor(parameters: RoadPartType) {
        if (!parameters) return
        this.directions = parameters.directions instanceof Array ? parameters.directions : []
        this.url = parameters.url
        this.name = parameters.name
    }

    clone() {
        const {url, name, directions} = this

        return new RoadPart({
            url,
            name,
            directions: [...directions]
        })
    }
}

class LinkedRoadPart extends RoadPart {
    position: Vector3
    rotation?: number

    constructor(roadPart: RoadPart, position?: Vector3, rotation?: number) {
        super(roadPart)
        this.position = position instanceof Vector3 ? position : new Vector3()
        if (rotation || rotation === 0) {
            this.rotation = this.rotation
        }
    }

    rotate(angle: number) {
        this.directions = this.directions.map((direction: Vector3) => direction.applyAxisAngle(new Vector3(0,1,0),angle))
        if (this.rotation) {
            this.rotation += angle
        } else {
            this.rotation = angle
        }
    }

    translate(newPosition: Vector3) {
        this.position.add(newPosition)
    }

    connect(next: RoadPart): LinkedRoadPart {
        // TODO
        return null
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
        const end = this.getRoadPartByName('road_end')
        const turn = this.getRoadPartByName('road_bend')
        this.connect(end)
        this.connectAll(this.createStraightLine(length-3))
        this.connect(turn)
        this.connect(end)
    }
    connectAll(parts: RoadPart[]) {
        parts.forEach(part => this.connect(part))
    }
    connect(part: RoadPart) {
        let linkedRoadPart = new LinkedRoadPart(part)
        if (this.path.length > 0) {
            linkedRoadPart.translate(this.calculateNext(part))
        }
        this.path.push(linkedRoadPart)
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
        const part = this.parts.find(part => part.name === name)
        if (part instanceof RoadPart) {
            return part.clone()
        } else {
            return null
        }
    }
    getPath() {
        return this.path
    }
}

module.exports = {
    RoadPart,
    Road,
    LinkedRoadPart
}