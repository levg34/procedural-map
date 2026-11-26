import { Vector3 } from 'three'
import { LinkedRoadPart, RoadPart } from './classes'
import type { RoadPartMetadata } from './utils'
import { getRoadParts } from './utils'

const EPSILON = 0.000001
const MAX_ATTEMPTS = 64

export type GridVector = {
    x: number
    y: number
    z: number
}

export type GridTile = {
    id: number
    name: string
    position: GridVector
    rotation?: number
    directions: GridVector[]
    usedDirections: GridVector[]
    connectionOffsets: GridVector[]
}

export type GridConnection = {
    from: number
    fromDirection: GridVector
    to: number
    toDirection: GridVector
    point: GridVector
}

export type RoadNetwork = {
    size: number
    tiles: GridTile[]
    connections: GridConnection[]
    routes: GridTile[][]
}

type Port = {
    tileId: number
    direction: Vector3
    point: Vector3
}

type State = {
    size: number
    templates: RoadPart[]
    required: RoadPart[]
    tiles: LinkedRoadPart[]
    open: Port[]
    connections: GridConnection[]
    usedTypes: Set<string>
    rng: () => number
}

type Placement = {
    portIndex: number
    template: RoadPart
    rotation: number
    closes: number
    unused: boolean
    order: number
}

function toGridVector(vector: Vector3): GridVector {
    return { x: vector.x, y: vector.y, z: vector.z }
}

function sameDirection(a: Vector3, b: Vector3): boolean {
    return a.distanceToSquared(b) < EPSILON * EPSILON
}

function isOpposite(a: Vector3, b: Vector3): boolean {
    return a.clone().negate().distanceToSquared(b) < EPSILON * EPSILON
}

function samePoint(a: Vector3, b: Vector3): boolean {
    return a.distanceToSquared(b) < EPSILON * EPSILON
}

function overlap(a: LinkedRoadPart, b: LinkedRoadPart): boolean {
    const first = a.getFootprint()
    const second = b.getFootprint()
    return (
        Math.abs(a.position.x - b.position.x) < (first.width + second.width) / 2 - EPSILON &&
        Math.abs(a.position.z - b.position.z) < (first.depth + second.depth) / 2 - EPSILON
    )
}

function withinBounds(tile: LinkedRoadPart, size: number): boolean {
    const half = size / 2 + 0.5
    const footprint = tile.getFootprint()
    return (
        Math.abs(tile.position.x) - footprint.width / 2 <= half &&
        Math.abs(tile.position.z) - footprint.depth / 2 <= half
    )
}

function pointWithinBounds(point: Vector3, size: number): boolean {
    const half = size / 2 + 0.5
    return Math.abs(point.x) <= half && Math.abs(point.z) <= half
}

function mulberry32(seed: number): () => number {
    let value = seed >>> 0
    return () => {
        value = (value + 0x6d2b79f5) >>> 0
        let result = value
        result = Math.imul(result ^ (result >>> 15), result | 1)
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296
    }
}

function shuffle<T>(items: T[], rng: () => number): T[] {
    const result = [...items]
    for (let index = result.length - 1; index > 0; index--) {
        const other = Math.floor(rng() * (index + 1))
        const current = result[index]
        const chosen = result[other]
        if (current === undefined || chosen === undefined) continue
        result[index] = chosen
        result[other] = current
    }
    return result
}

function restore(state: State, previous: State): void {
    state.tiles = previous.tiles
    state.open = previous.open
    state.connections = previous.connections
    state.usedTypes = previous.usedTypes
}

function snapshot(state: State): State {
    return {
        ...state,
        tiles: [...state.tiles],
        open: [...state.open],
        connections: [...state.connections],
        usedTypes: new Set(state.usedTypes)
    }
}

function addConnection(
    state: State,
    from: number,
    fromDirection: Vector3,
    to: number,
    toDirection: Vector3,
    point: Vector3
): void {
    state.connections.push({
        from,
        fromDirection: toGridVector(fromDirection),
        to,
        toDirection: toGridVector(toDirection),
        point: toGridVector(point)
    })
}

function markUsed(tile: LinkedRoadPart, direction: Vector3): void {
    const match = tile.directions.find((candidate) => sameDirection(candidate, direction))
    if (match && !tile.usedDirections.includes(match)) tile.usedDirections.push(match)
}

function tryClose(state: State, portIndex: number, otherIndex: number): boolean {
    const port = state.open[portIndex]
    const other = state.open[otherIndex]
    const first = port ? state.tiles[port.tileId] : undefined
    const second = other ? state.tiles[other.tileId] : undefined
    if (!port || !other || !first || !second || port.tileId === other.tileId) return false
    if (!samePoint(port.point, other.point) || !isOpposite(port.direction, other.direction)) return false

    const firstClone = first.clone()
    const secondClone = second.clone()
    markUsed(firstClone, port.direction)
    markUsed(secondClone, other.direction)
    state.tiles[port.tileId] = firstClone
    state.tiles[other.tileId] = secondClone
    const indices = new Set([portIndex, otherIndex])
    addConnection(state, port.tileId, port.direction, other.tileId, other.direction, port.point)
    state.open = state.open.filter((_, index) => !indices.has(index))
    return true
}

function tryPlace(state: State, portIndex: number, template: RoadPart, rotation: number): boolean {
    const port = state.open[portIndex]
    const source = port ? state.tiles[port.tileId] : undefined
    if (!port || !source) return false

    const part = template.clone()
    if (rotation !== 0) part.rotate((rotation * Math.PI) / 2)
    const incoming = part.directions.find((direction) => isOpposite(direction, port.direction))
    if (!incoming) return false

    const sourceClone = source.clone()
    let next: LinkedRoadPart
    try {
        next = sourceClone.connectVia(part, port.direction)
    } catch {
        return false
    }

    if (!withinBounds(next, state.size)) return false
    if (state.tiles.some((tile) => tile !== source && overlap(tile, next))) return false

    const newPorts: Port[] = next.getAvailableDirections().map((direction) => ({
        tileId: state.tiles.length,
        direction: direction.clone(),
        point: next.getConnectionPoint(direction)
    }))
    if (newPorts.some((candidate) => !pointWithinBounds(candidate.point, state.size))) return false

    const nextId = state.tiles.length
    state.tiles[port.tileId] = sourceClone
    state.tiles.push(next)
    addConnection(state, port.tileId, port.direction, nextId, incoming, port.point)

    const remaining = state.open.filter((_, index) => index !== portIndex)
    for (const candidate of newPorts) {
        const matchIndex = remaining.findIndex(
            (open) =>
                open.tileId !== candidate.tileId &&
                samePoint(open.point, candidate.point) &&
                isOpposite(open.direction, candidate.direction)
        )
        const match = remaining[matchIndex]
        if (match) {
            const matchTile = state.tiles[match.tileId]
            if (matchTile) {
                const matchClone = matchTile.clone()
                markUsed(matchClone, match.direction)
                state.tiles[match.tileId] = matchClone
            }
            markUsed(next, candidate.direction)
            addConnection(state, match.tileId, match.direction, candidate.tileId, candidate.direction, candidate.point)
            remaining.splice(matchIndex, 1)
        } else {
            remaining.push(candidate)
        }
    }
    state.open = remaining
    state.usedTypes.add(next.name)
    return true
}

function findPlacements(state: State, template: RoadPart, portIndices?: number[]): Placement[] {
    const placements: Placement[] = []
    const indices = portIndices ?? state.open.map((_, index) => index)
    for (const portIndex of indices) {
        for (const rotation of [0, 1, 2, 3]) {
            const trial = snapshot(state)
            if (!tryPlace(trial, portIndex, template, rotation)) continue
            placements.push({
                portIndex,
                template,
                rotation,
                closes: state.open.length - trial.open.length,
                unused: !state.usedTypes.has(template.name),
                order: state.rng()
            })
        }
    }
    return placements
}

function allPortsFeasible(state: State): boolean {
    return state.open.every((_, index) =>
        state.templates.some((template) => findPlacements(state, template, [index]).length > 0)
    )
}

function closeCoincidentPorts(state: State): boolean {
    for (let index = 0; index < state.open.length; index++) {
        for (let other = index + 1; other < state.open.length; other++) {
            if (tryClose(state, index, other)) return true
        }
    }
    return false
}

function placeRequiredTypes(state: State): void {
    let progress = true
    while (state.usedTypes.size < state.required.length && progress) {
        progress = false
        const missing = shuffle(
            state.required.filter((template) => !state.usedTypes.has(template.name)),
            state.rng
        )
        for (const template of missing) {
            const options = findPlacements(state, template)
            if (options.length === 0) continue
            options.sort((a, b) => b.closes - a.closes || a.order - b.order)
            const best = options[0]
            const before = snapshot(state)
            const applied = best ? tryPlace(state, best.portIndex, template, best.rotation) : false
            if (applied && allPortsFeasible(state)) {
                progress = true
                break
            }
            restore(state, before)
        }
    }
}

function closeRemainingPorts(state: State): void {
    const limit = state.size * state.size * 2
    while (state.open.length > 0) {
        if (closeCoincidentPorts(state)) continue
        if (state.tiles.length >= limit) throw new Error('Road network exceeded the grid budget')

        const options = state.templates.flatMap((template) => findPlacements(state, template))
        if (options.length === 0) throw new Error('No road part fits an open connector')
        options.sort(
            (a, b) =>
                b.closes - a.closes ||
                Number(b.unused) - Number(a.unused) ||
                Number(a.template.name === 'road_end') - Number(b.template.name === 'road_end') ||
                a.order - b.order
        )
        let applied = false
        for (const option of options) {
            const before = snapshot(state)
            applied = tryPlace(state, option.portIndex, option.template, option.rotation)
            if (applied && allPortsFeasible(state)) break
            restore(state, before)
            applied = false
        }
        if (!applied) throw new Error('Could not close an open connector')
    }
}

function tileToGrid(tile: LinkedRoadPart, id: number): GridTile {
    return {
        id,
        name: tile.name,
        position: toGridVector(tile.position),
        rotation: tile.rotation,
        directions: tile.directions.map(toGridVector),
        usedDirections: tile.usedDirections.map(toGridVector),
        connectionOffsets: tile.connectionOffsets.map(toGridVector)
    }
}

function isConnected(tiles: GridTile[], connections: GridConnection[]): boolean {
    if (tiles.length === 0) return false
    const adjacency = new Map<number, number[]>()
    connections.forEach((connection) => {
        adjacency.set(connection.from, [...(adjacency.get(connection.from) ?? []), connection.to])
        adjacency.set(connection.to, [...(adjacency.get(connection.to) ?? []), connection.from])
    })
    const visited = new Set<number>([tiles[0]!.id])
    const queue = [tiles[0]!.id]
    while (queue.length > 0) {
        const current = queue.shift()
        if (current === undefined) continue
        for (const neighbor of adjacency.get(current) ?? []) {
            if (visited.has(neighbor)) continue
            visited.add(neighbor)
            queue.push(neighbor)
        }
    }
    return visited.size === tiles.length
}

function vectorFromGrid(vector: GridVector): Vector3 {
    return new Vector3(vector.x, vector.y, vector.z)
}

export function createRoutes(tiles: GridTile[], connections: GridConnection[]): GridTile[][] {
    const adjacency = new Map<number, { to: number; direction: GridVector }[]>()
    connections.forEach((connection) => {
        adjacency.set(connection.from, [
            ...(adjacency.get(connection.from) ?? []),
            { to: connection.to, direction: connection.fromDirection }
        ])
        adjacency.set(connection.to, [
            ...(adjacency.get(connection.to) ?? []),
            { to: connection.from, direction: connection.toDirection }
        ])
    })

    const routes: GridTile[][] = []
    const visited = new Set<number>()
    const byId = new Map(tiles.map((tile) => [tile.id, tile]))

    while (visited.size < tiles.length && routes.length < 4) {
        const candidates = tiles.filter((tile) => !visited.has(tile.id))
        const start =
            candidates.find((tile) => tile.name === 'road_end') ??
            candidates.sort((a, b) => (adjacency.get(a.id)?.length ?? 0) - (adjacency.get(b.id)?.length ?? 0))[0]
        if (!start) break

        const route: GridTile[] = []
        let current = start.id
        let entry: GridVector | undefined
        while (true) {
            const tile = byId.get(current)
            if (!tile) break
            const exits = (adjacency.get(current) ?? []).filter(
                (edge) =>
                    !visited.has(edge.to) &&
                    (!entry || !sameDirection(vectorFromGrid(edge.direction), vectorFromGrid(entry)))
            )
            const exit = exits[0]
            const usedDirections = exit ? (entry ? [entry, exit.direction] : [exit.direction]) : entry ? [entry] : []
            route.push({ ...tile, usedDirections })
            visited.add(current)
            if (!exit) break
            const back = (adjacency.get(exit.to) ?? []).find((edge) => edge.to === current)
            entry = back?.direction ?? toGridVector(vectorFromGrid(exit.direction).negate())
            current = exit.to
        }
        if (route.length > 1) routes.push(route)
    }

    return routes
}

export function minimumGridSize(parts: RoadPartMetadata[]): number {
    const connectable = parts.filter((part) => part.directions && part.directions.length > 0)
    const area = connectable.reduce((total, part) => {
        const footprint = part.footprint ?? { width: 1, depth: 1 }
        return total + footprint.width * footprint.depth
    }, 0)
    return Math.max(2, Math.ceil(Math.sqrt(area * 1.6)))
}

export function generateRoadNetwork(parts: RoadPartMetadata[], size: number, seed = size): RoadNetwork {
    if (!Number.isInteger(size)) throw new Error('Grid size must be an integer')
    const minimum = minimumGridSize(parts)
    if (size < minimum) throw new Error(`Grid size must be at least ${minimum} to use every road type`)

    const templates = parts
        .filter((part) => part.directions instanceof Array && part.directions.length > 0)
        .map((part) => new RoadPart(part))
    if (templates.length === 0) throw new Error('No connectable road parts available')

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const rng = mulberry32(seed + attempt * 7919)
        const seedTemplate =
            templates.find((template) => template.directions.length === 4) ??
            templates.find((template) => template.directions.length > 1) ??
            templates[0]!
        const seedPart = new LinkedRoadPart(seedTemplate)
        const state: State = {
            size,
            templates,
            required: templates,
            tiles: [seedPart],
            open: seedPart.directions.map((direction) => ({
                tileId: 0,
                direction: direction.clone(),
                point: seedPart.getConnectionPoint(direction)
            })),
            connections: [],
            usedTypes: new Set([seedPart.name]),
            rng
        }

        try {
            placeRequiredTypes(state)
            closeRemainingPorts(state)
        } catch {
            continue
        }
        if (state.usedTypes.size !== state.required.length) continue
        if (
            !isConnected(
                state.tiles.map((tile, id) => tileToGrid(tile, id)),
                state.connections
            )
        )
            continue

        const tiles = state.tiles.map((tile, id) => tileToGrid(tile, id))
        return {
            size,
            tiles,
            connections: state.connections,
            routes: createRoutes(tiles, state.connections)
        }
    }

    throw new Error(`Could not generate a closed road network for grid size ${size}`)
}

export function networkFromPath(path: Omit<GridTile, 'id'>[]): RoadNetwork {
    const tiles = path.map((tile, id) => ({ ...tile, id }))
    return { size: tiles.length, tiles, connections: [], routes: [tiles] }
}

export async function buildRoadNetwork(size: number, seed?: number): Promise<RoadNetwork> {
    return generateRoadNetwork(await getRoadParts(), size, seed)
}
