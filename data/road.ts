import { Vector3 } from 'three'

export type RoadTypeConfig = {
    for: string[]
    directions: Vector3[]
}

export type RoadFootprint = {
    width: number
    depth: number
}

export const roadFootprints: Record<string, RoadFootprint> = {
    road_curve: { width: 2, depth: 2 },
    road_curveIntersection: { width: 2, depth: 2 },
    road_curvePavement: { width: 2, depth: 2 },
    road_roundabout: { width: 3, depth: 3 },
    road_side: { width: 1, depth: 1.32 },
    road_sideEntry: { width: 1, depth: 1.32 },
    road_sideExit: { width: 1, depth: 1.32 },
    road_split: { width: 1, depth: 2 }
}

export const roadConnectionOffsets: Record<string, Vector3[]> = {
    road_curve: [new Vector3(1, 0, 0.5), new Vector3(-0.5, 0, -1)],
    road_curveIntersection: [new Vector3(1, 0, 0.5), new Vector3(-1, 0, 0.5), new Vector3(-0.5, 0, -1)],
    road_curvePavement: [new Vector3(1, 0, 0.5), new Vector3(-0.5, 0, -1)],
    road_side: [new Vector3(0.5, 0, -0.155), new Vector3(-0.5, 0, -0.155)],
    road_sideEntry: [new Vector3(0.5, 0, -0.155), new Vector3(-0.5, 0, -0.155)],
    road_sideExit: [new Vector3(0.5, 0, -0.155), new Vector3(-0.5, 0, -0.155)]
}

const turn: RoadTypeConfig = {
    for: ['road_bend', 'road_bendSquare', 'road_bendSidewalk', 'road_curve', 'road_curvePavement'],
    directions: [new Vector3(1, 0, 0), new Vector3(0, 0, -1)]
}

const straight: RoadTypeConfig = {
    for: [
        'road_crossing',
        'road_drivewayDouble',
        'road_drivewaySingle',
        'road_side',
        'road_sideEntry',
        'road_sideExit',
        'road_straight'
    ],
    directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0)]
}

const allDirections: RoadTypeConfig = {
    for: ['road_crossroad', 'road_crossroadLine', 'road_crossroadPath', 'road_roundabout'],
    directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)]
}

const tripleIntersection: RoadTypeConfig = {
    for: ['road_curveIntersection', 'road_intersection', 'road_intersectionLine', 'road_intersectionPath'],
    directions: [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 0, -1)]
}

const roadEnd: RoadTypeConfig = {
    for: ['road_end'],
    directions: [new Vector3(-1, 0, 0)]
}

const noEntry: RoadTypeConfig = {
    for: ['road_square'],
    directions: []
}

export const roadTypes: Record<string, RoadTypeConfig> = {
    turn,
    straight,
    allDirections,
    tripleIntersection,
    roadEnd,
    noEntry
}
