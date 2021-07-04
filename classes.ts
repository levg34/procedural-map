import { Vector3 } from "three"

const { getRoadParts } = require('./utils')

type RoadPartType = {
    url: string
    name: string
    directions?: Vector3[]
    rotation?: number
}

class RoadPart {
    url: string
    name: string
    directions: Vector3[]
    rotation?: number

    constructor(parameters: RoadPartType) {
        if (!parameters) return
        this.directions = parameters.directions instanceof Array ? parameters.directions : []
        this.url = parameters.url
        this.name = parameters.name
        if (parameters.rotation || parameters.rotation === 0) {
            this.rotation = parameters.rotation
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

    clone(): RoadPart {
        const {url, name, directions, rotation} = this

        const roadClone = new RoadPart({
            url,
            name,
            directions: directions.map(direction => direction.clone())
        })

        if (rotation || rotation === 0) {
            roadClone.rotation = rotation
        }

        return roadClone
    }
}

class LinkedRoadPart extends RoadPart {
    position: Vector3
    usedDirections: Vector3[]

    constructor(roadPart: RoadPart, position?: Vector3, usedDirections?: Vector3[])  {
        super(roadPart instanceof RoadPart ? roadPart.clone() : roadPart)
        this.position = position instanceof Vector3 ? position : new Vector3()
        this.usedDirections = usedDirections instanceof Array ? usedDirections : []
    }

    translate(newPosition: Vector3) {
        this.position.add(newPosition)
    }

    private selectDirection(direction?: Vector3): Vector3 {
        if (this.getAvailableDirections().length < 1) {
            throw new Error('No direction available')
        }

        let nextDirection: Vector3 = this.getAvailableDirections()[0]

        if (direction instanceof Vector3) {
            const connectDirection = this.getAvailableDirections().find(dir => dir.clone().add(direction).length() < 0.0000001)
            if (connectDirection instanceof Vector3) {
                nextDirection = connectDirection.clone()
            } else {
                let connectDirectionRotated: Vector3 | null = null
                while (!(connectDirectionRotated instanceof Vector3) || this.rotation > 3*Math.PI/2) {
                    this.rotate(Math.PI/2)
                    connectDirectionRotated = this.getAvailableDirections().find(dir => dir.clone().add(direction).length() < 0.0000001)
                }
                if (!(connectDirectionRotated instanceof Vector3)) {
                    throw new Error('Cound not connect to direction !')
                } else {
                    nextDirection = connectDirectionRotated.clone()
                }
            }
        }

        this.usedDirections.push(nextDirection)
        return nextDirection
    }

    connect(next: RoadPart): LinkedRoadPart {
        if (this.getAvailableDirections().length < 1) {
            throw new Error('No direction available')
        }
        const nextRoadPart = new LinkedRoadPart(next)
        nextRoadPart.translate(this.position)
        const direction = this.selectDirection()
        nextRoadPart.translate(direction)
        const nextDir = nextRoadPart.selectDirection(direction)
        // console.log(this.name+' -> '+next.name, nextDir)
        return nextRoadPart
    }

    getAvailableDirections(): Vector3[] {
        return this.directions.filter(direction => !this.usedDirections.includes(direction))
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
        const start = end.clone()
        start.rotate(Math.PI)
        const turn = this.getRoadPartByName('road_bend')
        this.connect(start)
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
            const previous = [...this.path].pop()
            linkedRoadPart = previous.connect(part)
        }
        this.path.push(linkedRoadPart)
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
                path.push(straight.clone())
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