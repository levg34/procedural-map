export type Compass = 'E' | 'W' | 'N' | 'S'

export type CircuitStep = {
    id: string
    name: string
    entry: Compass
    exit: Compass
}

export type CircuitShape = {
    name: string
    steps: CircuitStep[]
}

const step = (id: string, name: string, entry: Compass, exit: Compass): CircuitStep => ({ id, name, entry, exit })

/**
 * A closed circuit: roundabout and crossroad are each visited twice so all
 * four of their connectors are used. No connector is left open.
 */
const dumbbell: CircuitShape = {
    name: 'dumbbell',
    steps: [
        step('roundabout', 'road_roundabout', 'S', 'W'),
        step('loopC1', 'road_straight', 'E', 'W'),
        step('loopC2', 'road_bendSquare', 'E', 'N'),
        step('loopC3', 'road_crossing', 'S', 'N'),
        step('loopC4', 'road_bendSidewalk', 'S', 'E'),
        step('loopC5', 'road_drivewaySingle', 'W', 'E'),
        step('loopC6', 'road_drivewayDouble', 'W', 'E'),
        step('loopC7', 'road_bend', 'W', 'S'),
        step('roundabout', 'road_roundabout', 'N', 'E'),
        step('east1', 'road_bendSidewalk', 'W', 'S'),
        step('east2', 'road_straight', 'N', 'S'),
        step('east3', 'road_crossing', 'N', 'S'),
        step('east4', 'road_drivewaySingle', 'N', 'S'),
        step('east5', 'road_straight', 'N', 'S'),
        step('east6', 'road_crossing', 'N', 'S'),
        step('east7', 'road_bendSquare', 'N', 'W'),
        step('east8', 'road_drivewayDouble', 'E', 'W'),
        step('crossroad', 'road_crossroad', 'E', 'W'),
        step('loopD1', 'road_crossing', 'E', 'W'),
        step('loopD2', 'road_bend', 'E', 'S'),
        step('loopD3', 'road_straight', 'N', 'S'),
        step('loopD4', 'road_bendSquare', 'N', 'E'),
        step('loopD5', 'road_drivewaySingle', 'W', 'E'),
        step('loopD6', 'road_bendSidewalk', 'W', 'N'),
        step('loopD7', 'road_crossing', 'S', 'N'),
        step('crossroad', 'road_crossroad', 'S', 'N'),
        step('west1', 'road_drivewayDouble', 'S', 'N'),
        step('west2', 'road_straight', 'S', 'N'),
        step('west3', 'road_crossing', 'S', 'N'),
        step('west4', 'road_drivewaySingle', 'S', 'N')
    ]
}

export const circuitShapes: Record<string, CircuitShape> = { dumbbell }

export const defaultCircuitShape = 'dumbbell'
