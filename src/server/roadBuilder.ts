import { Vector3 } from 'three'
import type { RoadPartMetadata } from '../data/models'
import { roadTypes, roadVariantGroups, type RoadFootprint } from '../data/road'
import { getRoadParts } from './utils'

type RoadPartType = RoadPartMetadata & {
    rotation?: number
}

type RoadOptions = { length: number; seed?: number } | { showcase: true }

const defaultSeed = 1

function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}

class RoadPart {
    url: string
    name: string
    directions: Vector3[]
    footprint: RoadFootprint
    connectionOffsets: Vector3[]
    rotation?: number

    constructor(parameters: RoadPartType) {
        this.directions =
            parameters.directions instanceof Array ? parameters.directions.map((direction) => direction.clone()) : []
        this.connectionOffsets =
            parameters.connectionOffsets?.map((offset) => offset.clone()) ??
            this.directions.map(
                (direction) =>
                    new Vector3(
                        (direction.x * (parameters.footprint?.width ?? 1)) / 2,
                        0,
                        (direction.z * (parameters.footprint?.depth ?? 1)) / 2
                    )
            )
        this.url = parameters.url
        this.name = parameters.name
        this.footprint = parameters.footprint ?? { width: 1, depth: 1 }
        if (parameters.rotation || parameters.rotation === 0) {
            this.rotation = parameters.rotation
        }
    }

    rotate(angle: number): void {
        this.directions = this.directions.map((direction: Vector3) =>
            direction.applyAxisAngle(new Vector3(0, 1, 0), angle)
        )
        this.connectionOffsets = this.connectionOffsets.map((offset) =>
            offset.applyAxisAngle(new Vector3(0, 1, 0), angle)
        )
        if (this.rotation !== undefined) {
            this.rotation += angle
        } else {
            this.rotation = angle
        }
    }

    getFootprint(): RoadFootprint {
        const rotation = this.rotation ?? 0
        const cosine = Math.abs(Math.cos(rotation))
        const sine = Math.abs(Math.sin(rotation))
        return {
            width: cosine * this.footprint.width + sine * this.footprint.depth,
            depth: sine * this.footprint.width + cosine * this.footprint.depth
        }
    }

    getHalfExtentAlong(direction: Vector3): number {
        const footprint = this.getFootprint()
        return (Math.abs(direction.x) * footprint.width + Math.abs(direction.z) * footprint.depth) / 2
    }

    getConnectionOffset(direction: Vector3): Vector3 {
        const index = this.directions.indexOf(direction)
        const offset = this.connectionOffsets[index]
        if (!offset) throw new Error(`No connection offset available for ${this.name}`)
        return offset
    }

    clone(): RoadPart {
        const { url, name, directions, footprint, connectionOffsets, rotation } = this

        const roadClone = new RoadPart({
            url,
            name,
            directions: directions.map((direction) => direction.clone()),
            footprint: { ...footprint },
            connectionOffsets: connectionOffsets.map((offset) => offset.clone())
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

    constructor(roadPart: RoadPart, position?: Vector3, usedDirections?: Vector3[]) {
        super(roadPart instanceof RoadPart ? roadPart.clone() : roadPart)
        this.position = position instanceof Vector3 ? position : new Vector3()
        this.usedDirections = usedDirections instanceof Array ? usedDirections : []
    }

    translate(newPosition: Vector3): void {
        this.position.add(newPosition)
    }

    private selectDirection(direction?: Vector3): Vector3 {
        if (this.getAvailableDirections().length < 1) {
            throw new Error('No direction available')
        }

        let nextDirection: Vector3 = this.getAvailableDirections()[0]

        if (direction instanceof Vector3) {
            const connectDirection = this.getAvailableDirections().find(
                (dir) => dir.clone().add(direction).length() < 0.0000001
            )
            if (connectDirection instanceof Vector3) {
                nextDirection = connectDirection
            } else {
                let connectDirectionRotated: Vector3 | undefined
                let rotations = 0
                while (!(connectDirectionRotated instanceof Vector3) && rotations < 4) {
                    this.rotate(Math.PI / 2)
                    rotations++
                    connectDirectionRotated = this.getAvailableDirections().find(
                        (dir) => dir.clone().add(direction).length() < 0.0000001
                    )
                }
                if (!(connectDirectionRotated instanceof Vector3)) {
                    throw new Error('Could not connect to direction')
                } else {
                    nextDirection = connectDirectionRotated
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
        const direction = this.selectDirection()
        const nextDirection = nextRoadPart.selectDirection(direction)
        const offset = this.getConnectionOffset(direction).clone().sub(nextRoadPart.getConnectionOffset(nextDirection))
        nextRoadPart.translate(this.position)
        nextRoadPart.translate(offset)
        return nextRoadPart
    }

    getAvailableDirections(): Vector3[] {
        return this.directions.filter((direction) => !this.usedDirections.includes(direction))
    }
}

class Road {
    parts: RoadPart[]
    path: LinkedRoadPart[]
    private readonly random: () => number

    static async build(length: number, seed = defaultSeed): Promise<Road> {
        const parts = await getRoadParts()
        return new Road(parts, { length, seed })
    }

    static async buildShowcase(): Promise<Road> {
        const parts = await getRoadParts()
        return new Road(parts, { showcase: true })
    }

    constructor(parts: RoadPartMetadata[], options: RoadOptions) {
        this.parts = parts.map((part) => new RoadPart(part))
        this.path = []
        this.random = createSeededRandom('showcase' in options ? defaultSeed : (options.seed ?? defaultSeed))
        if ('showcase' in options) {
            this.createShowcasePath()
        } else {
            this.createPath(options.length, 5)
        }
    }

    createShowcasePath(): void {
        this.path = []

        const end = this.getRoadPartByName('road_end')
        if (!end) throw new Error('Required road part not found: road_end')

        const start = end.clone()
        start.rotate(Math.PI)
        this.connect(start)

        const sideRoadTransition = ['road_sideEntry', 'road_side', 'road_sideExit'].filter((name) =>
            this.parts.some((part) => part.name === name && part.directions.length > 1)
        )
        const transitionNames = new Set(sideRoadTransition)
        const groups = Object.values(roadTypes)
            .filter((type) => type.directions.length > 1)
            .map((type) =>
                type.for.filter((name) => this.parts.some((part) => part.name === name && part.directions.length > 1))
            )
        const roadPartNames: string[] = []

        const groupLength = Math.max(...groups.map((group) => group.length))
        for (let index = 0; index < groupLength; index++) {
            const names = groups
                .flatMap((group) => (group[index] ? [group[index]] : []))
                .filter((name) => !transitionNames.has(name))
            roadPartNames.push(...names)
        }

        const curveIndex = roadPartNames.indexOf('road_curve')
        roadPartNames.splice(curveIndex < 0 ? roadPartNames.length : curveIndex + 1, 0, ...sideRoadTransition)

        for (const name of roadPartNames) {
            const part = this.getRoadPartByName(name)
            if (!part) throw new Error(`Required road part not found: ${name}`)
            this.connect(part)
        }

        this.connect(end)

        const noEntry = this.getRoadPartByName('road_square')
        if (noEntry) {
            const occupied = new Set(this.path.map((part) => part.position.toArray().join(',')))
            const branch = this.path
                .flatMap((part) =>
                    part.getAvailableDirections().map((direction) => ({
                        part,
                        direction,
                        position: part.position
                            .clone()
                            .add(part.getConnectionOffset(direction))
                            .add(direction.clone().multiplyScalar(noEntry.getHalfExtentAlong(direction)))
                    }))
                )
                .find(({ position }) => !occupied.has(position.toArray().join(',')))

            if (!branch) throw new Error('No free intersection branch available for road_square')
            this.path.push(new LinkedRoadPart(noEntry, branch.position))
        }
    }

    private pickRoadPart(names: readonly string[]): RoadPart {
        const availableNames = names.filter((name) => this.parts.some((part) => part.name === name))
        if (availableNames.length < 1) {
            throw new Error(`Required road part not found: ${names.join(', ')}`)
        }

        const name = availableNames[Math.floor(this.random() * availableNames.length)] ?? availableNames[0]
        if (!name) throw new Error(`Required road part not found: ${names.join(', ')}`)

        const part = this.getRoadPartByName(name)
        if (!part) throw new Error(`Required road part not found: ${name}`)
        return part
    }

    private pickRoundaboutSlot(sections: RoadPart[][]): { section: number; index: number } | null {
        const intersectionNames = new Set<string>(roadVariantGroups.intersection)
        const slots = sections.flatMap((section, sectionIndex) =>
            section
                .map((part, index) => ({ part, index, sectionIndex }))
                .filter(({ part }) => !intersectionNames.has(part.name))
                .map(({ index, sectionIndex }) => ({ section: sectionIndex, index }))
        )
        if (slots.length < 1) return null
        return slots[Math.floor(this.random() * slots.length)] ?? null
    }

    createPath(length: number, turns: number): void {
        const end = this.getRoadPartByName('road_end')
        if (!end) throw new Error('Required road part not found: road_end')

        const start = end.clone()
        start.rotate(Math.PI)
        this.connect(start)

        const sections = Array.from({ length: turns + 1 }, () => this.createStraightLine(length))
        const roundaboutSlot = this.pickRoundaboutSlot(sections)
        if (roundaboutSlot) {
            const section = sections[roundaboutSlot.section]
            if (section) section[roundaboutSlot.index] = this.pickRoadPart(roadVariantGroups.roundabout)
        }

        sections.forEach((section, sectionIndex) => {
            this.connectAll(section)
            if (sectionIndex < turns) this.connect(this.pickRoadPart(roadVariantGroups.turn))
        })

        this.connect(end)
    }

    connectAll(parts: RoadPart[]): void {
        parts.forEach((part) => this.connect(part))
    }

    connect(part: RoadPart): void {
        let linkedRoadPart = new LinkedRoadPart(part)
        if (this.path.length > 0) {
            const previous = this.path[this.path.length - 1]
            if (!previous) throw new Error('Road path is missing its previous segment')

            linkedRoadPart = previous.connect(part)
        }
        this.path.push(linkedRoadPart)
    }

    createStraightLine(length: number): RoadPart[] {
        const path: RoadPart[] = []
        if (length < 2) return path

        const crossingPosition = Math.floor(length / 2)
        for (let i = 0; i < length; ++i) {
            path.push(
                i === crossingPosition
                    ? this.pickRoadPart(roadVariantGroups.intersection)
                    : this.pickRoadPart(roadVariantGroups.straight)
            )
        }

        return path
    }

    getRoadPartByName(name: string): RoadPart | null {
        const part = this.parts.find((part) => part.name === name)
        if (part instanceof RoadPart) {
            return part.clone()
        } else {
            return null
        }
    }

    getPath(): LinkedRoadPart[] {
        return this.path
    }
}

export { RoadPart, Road, LinkedRoadPart }
